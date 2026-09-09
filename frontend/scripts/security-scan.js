import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { repositoryDir } from "../e2e/support/environment.js";

const root = path.join(repositoryDir, "frontend", ".e2e", "security");
mkdirSync(root, { recursive: true });
const reports = mkdtempSync(path.join(root, "run-"));
const gitEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "safe.directory",
  GIT_CONFIG_VALUE_0: repositoryDir,
};

function run(binary, args, { env = process.env, allowed = [0], timeout = 600_000 } = {}) {
  const result = spawnSync(binary, args, {
    cwd: repositoryDir,
    env,
    windowsHide: true,
    encoding: "utf8",
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || !allowed.includes(result.status)) {
    throw new Error(
      `${path.basename(binary)} failed (${result.error?.code ?? result.status}); reports remain in ${reports}.`,
    );
  }
  return { code: result.status, output: result.stdout.trim() };
}

function tool(name, version, folder) {
  const cached = path.join(root, "tools", folder, `${name}.exe`);
  const binary =
    process.env[`${name.toUpperCase()}_BIN`] ||
    (process.platform === "win32" && existsSync(cached) ? cached : name);
  const { output } = run(binary, ["version"]);
  if (
    name === "gitleaks" ? output !== version : !output.includes(`Version:             ${version}`)
  ) {
    throw new Error(
      `Install the reviewed ${name} ${version}; see docs/security/release-review-2026-09-09.md.`,
    );
  }
  return binary;
}

function cleanupSnapshot(snapshot) {
  if (path.dirname(snapshot) !== reports || realpathSync(snapshot) !== snapshot)
    throw new Error("Unsafe scan snapshot cleanup path.");
  try {
    rmSync(snapshot, { recursive: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
    console.warn(
      `Scan completed; Windows retained locked input copies at ${snapshot}. They remain ignored and local.`,
    );
  }
}

function secrets() {
  const scanner = tool("gitleaks", "8.30.1", "gitleaks-8.30.1");
  if (run("git", ["rev-parse", "--is-shallow-repository"], { env: gitEnv }).output !== "false") {
    throw new Error(
      "Full-history scan requires a non-shallow clone; no fetch is performed automatically.",
    );
  }
  const common = [
    "--redact=100",
    "--no-banner",
    "--report-format=json",
    "--gitleaks-ignore-path",
    path.join(repositoryDir, ".gitleaksignore"),
  ];
  const history = run(
    scanner,
    [
      "git",
      repositoryDir,
      "--log-opts=--all --full-history",
      ...common,
      "--report-path",
      path.join(reports, "history.json"),
    ],
    { env: gitEnv, allowed: [0, 1] },
  );
  // Scan only files Git would share, including new nonignored source. Never copy
  // ignored .env, backups, reports or dependencies into the scan's input snapshot.
  const snapshot = mkdtempSync(path.join(reports, "source-"));
  let working;
  let cleanupFailure;
  try {
    const files = run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      env: gitEnv,
    })
      .output.split("\0")
      .filter(Boolean);
    for (const file of new Set(files)) {
      const source = path.join(repositoryDir, file);
      if (!existsSync(source)) continue; // Pending deletion, still checked in history.
      if (!lstatSync(source).isFile())
        throw new Error("Scan snapshot refuses links or non-file Git entries.");
      const target = path.resolve(snapshot, file);
      if (!target.startsWith(snapshot + path.sep)) throw new Error("Unsafe Git filename.");
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    working = run(
      scanner,
      ["dir", snapshot, ...common, "--report-path", path.join(reports, "working-tree.json")],
      { allowed: [0, 1] },
    );
  } finally {
    try {
      cleanupSnapshot(snapshot);
    } catch (error) {
      cleanupFailure = error; // Do not replace a primary scanner failure in finally.
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  const commits = new Set(
    run("git", ["log", "--all", "--format=%H"], { env: gitEnv }).output.split("\n"),
  ).size;
  console.info(
    `Scanned ${commits} commits across local refs and the shareable working tree. Redacted reports: ${reports}`,
  );
  if (history.code || working.code)
    throw new Error("Unreviewed secret candidates found; inspect redacted reports before sharing.");
}

function images() {
  const scanner = tool("grype", "0.118.0", "grype-0.118.0");
  const env = {
    ...process.env,
    GRYPE_DB_CACHE_DIR: path.join(root, "grype-db"),
    GRYPE_CHECK_FOR_APP_UPDATE: "false",
  };
  const summary = [];
  for (const service of ["api", "collector", "web"]) {
    const image = `landing-page-${service}:release-check`;
    const context = service === "web" ? "frontend" : "my-backend";
    console.info(`Building and scanning ${service} locally (no publication)...`);
    run("docker", [
      "build",
      "--quiet",
      "--tag",
      image,
      ...(service === "web" ? [] : ["--target", service]),
      "--file",
      `${context}/Dockerfile`,
      context,
    ]);
    const imageInfo = JSON.parse(run("docker", ["image", "inspect", image]).output)[0];
    const archive = path.join(reports, `${service}.tar`);
    run("docker", ["image", "save", "--output", archive, image]);
    const report = path.join(reports, `${service}.json`);
    const result = run(
      scanner,
      [
        `docker-archive:${archive}`,
        "--config",
        path.join(repositoryDir, "docs/security/grype.yaml"),
        "--output",
        "json",
        "--file",
        report,
        "--fail-on",
        "high",
      ],
      { env, allowed: [0, 2] },
    );
    const findings = JSON.parse(readFileSync(report, "utf8"));
    const severities = {};
    for (const match of findings.matches)
      severities[match.vulnerability.severity] =
        (severities[match.vulnerability.severity] ?? 0) + 1;
    summary.push({ service, image, imageID: imageInfo.Id, failed: result.code === 2, severities });
    console.info(`${service}: ${JSON.stringify(severities)}`);
  }
  writeFileSync(
    path.join(reports, "summary.json"),
    JSON.stringify({ scannedAt: new Date().toISOString(), images: summary }, null, 2) + "\n",
    { flag: "wx" },
  );
  console.info(`Local image reports and exact image IDs: ${reports}`);
  if (summary.some((image) => image.failed))
    throw new Error("High/critical image findings remain; release gate failed.");
}

try {
  if (process.argv.length !== 3)
    throw new Error("Use task security:secrets or task security:images.");
  if (process.argv[2] === "secrets") secrets();
  else if (process.argv[2] === "images") images();
  else throw new Error("Unknown security check.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
