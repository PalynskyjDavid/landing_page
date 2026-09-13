import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const read = (file) => readFileSync(path.join(root, file), "utf8");
const unix = (file) =>
  file.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive) => "/" + drive.toLowerCase());

test("only the HTTPS edge publishes ports; production DB is durable and isolated", () => {
  const config = parse(read("compose.prod.yml"));
  assert.equal(config.name, "landing-page-prod");
  for (const [name, service] of Object.entries(config.services)) {
    if (name !== "edge") assert.equal(service.ports, undefined, name);
    if (["db", "edge", "restore-check"].includes(name))
      assert.match(service.image, /@sha256:[a-f0-9]{64}$/);
  }
  assert.deepEqual(config.services.edge.ports, ["80:80", "443:443"]);
  assert.equal(config.networks.backend.internal, true);
  assert(config.services.db.volumes.includes("database:/var/lib/postgresql/data"));
  assert.equal(config.services.api.environment.COOKIE_SECURE, "true");
  assert.equal(config.services.api.environment.CORS_ORIGIN, "");
  assert.match(config.services.api.environment.DATABASE_URL, /\/\/app_api:/);
  assert.match(config.services.collector.environment.DATABASE_URL, /\/\/app_collector:/);
  assert.match(config.services.migrate.environment.DATABASE_URL, /\/\/app_migrator:/);
  assert.equal(config.services.collector.network_mode, "service:web");
  assert.deepEqual(config.services.migrate.profiles, ["tools"]);
  assert.equal(config.services.restore_check, undefined);
  assert.equal(config.services["restore-check"].network_mode, "none");
  assert.equal(config.services["restore-check"].volumes, undefined);
  assert.deepEqual(config.services["restore-check"].profiles, ["tools"]);
});

test("proxy trust matches Caddy's exact IP, while local defaults trust nobody", () => {
  const config = parse(read("compose.prod.yml"));
  const ip = config.services.edge.networks.edge.ipv4_address;
  assert.equal(config.networks.edge.ipam.config[0].ip_range, "172.30.46.128/25");
  const trust = read("deploy/nginx-proxy-trust.conf");
  assert(trust.includes("set_real_ip_from " + ip + ";"));
  assert.equal((trust.match(/set_real_ip_from /g) || []).length, 1);
  assert(!read("frontend/proxy-trust.conf").includes("set_real_ip_from"));
  assert(
    read("frontend/nginx.conf").includes("proxy_set_header X-Forwarded-Proto $origin_scheme;"),
  );
  assert(read("frontend/.dockerignore").includes("!proxy-trust.conf"));
  assert(read("my-backend/.dockerignore").includes("!migrations/*.sql"));
  assert(read("my-backend/Dockerfile").includes("ENV USER=app_migrator HOME=/app"));
});

test("deployment shell scripts parse without executing anything", () => {
  for (const script of ["deploy/production.sh", "deploy/init-db.sh"]) {
    const result = spawnSync(bash, ["-n", unix(path.join(root, script))], { encoding: "utf8" });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert(!read(script).includes("\r"), "Shell scripts must retain LF line endings");
  }
});

test("production startup flags are accepted by the real Compose CLI without starting containers", () => {
  const commands = [...read("deploy/production.sh").matchAll(/^\s*dc (run|up) ([^\r\n]+)$/gm)];
  assert(commands.some(([, subcommand]) => subcommand === "run"));
  assert(commands.some(([, subcommand]) => subcommand === "up"));

  for (const [, subcommand, argumentsText] of commands) {
    // These startup calls use literal, single-line arguments. Fail if that changes
    // instead of silently treating shell syntax as a valid Compose invocation.
    assert.match(argumentsText, /^[\w\s-]+$/);
    const args = argumentsText.trim().split(/\s+/);
    // Help MUST precede the service: after it, run treats --help as the container's
    // command. This validates flags without loading a project or contacting Docker.
    const result = spawnSync("docker", ["compose", subcommand, "--help", ...args], {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
    assert.equal(
      result.status,
      0,
      `docker compose ${subcommand} ${argumentsText}: ${result.error?.message || result.stderr}`,
    );
    assert.match(result.stdout, /Usage:/);
  }
});

function fixture(t, overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "landing-deploy-unit-"));
  // Cleanup is restricted to the fresh directory created for this test.
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, "deploy"));
  mkdirSync(path.join(dir, "bin"));
  cpSync(path.join(root, "deploy/production.sh"), path.join(dir, "deploy/production.sh"));
  writeFileSync(path.join(dir, "compose.prod.yml"), "");
  writeFileSync(path.join(dir, "deploy/grants.sql"), "SELECT 1;\n");
  const envFile = path.join(dir, "deploy/.env");
  writeFileSync(
    envFile,
    [
      "DOMAIN=portfolio.test",
      ...["ADMIN", "MIGRATOR", "API", "COLLECTOR"].map(
        (key) => key + "_PASSWORD=" + "a".repeat(64),
      ),
      "",
    ].join("\n"),
  );
  chmodSync(envFile, 0o600);
  const mocks = {
    docker: `printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  *pg_dump*) [[ \${FAIL_BACKUP:-0} != 1 ]] || exit 21; printf 'test backup';;
  *run*migrate*) [[ \${FAIL_MIGRATION:-0} != 1 ]] || exit 22;;
esac
exit 0`,
    git: `case "$1" in
  rev-parse) printf '%040d\\n' 1;;
  diff) [[ \${DIRTY_CHECKOUT:-0} != 1 ]];;
esac`,
    curl: "exit 0",
    flock: "exit 0",
    // Windows filesystem permissions differ; unit tests isolate the parser/flow.
    stat: "echo 600",
  };
  for (const [name, body] of Object.entries(mocks)) {
    const file = path.join(dir, "bin", name);
    writeFileSync(file, "#!/usr/bin/env bash\n" + body + "\n");
    chmodSync(file, 0o755);
  }
  const log = path.join(dir, "commands.log");
  const env = { ...process.env, ...overrides, DEPLOY_TEST_LOG: unix(log) };
  // Export the mock path INSIDE Bash so Windows PATH conversion cannot reorder it.
  function run(...args) {
    return spawnSync(
      bash,
      [
        "-c",
        'export PATH="$1/bin:$PATH"; shift; exec bash "$@"',
        "test",
        unix(dir),
        unix(path.join(dir, "deploy/production.sh")),
        ...args,
      ],
      {
        cwd: dir,
        env,
        encoding: "utf8",
      },
    );
  }
  return { dir, envFile, run, calls: () => (existsSync(log) ? readFileSync(log, "utf8") : "") };
}

test("deploy backs up before migrations, grants before app startup, then rebinds collector", (t) => {
  const f = fixture(t);
  const result = f.run("up");
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const calls = f.calls();
  const positions = [
    "pg_dump",
    "run --rm",
    "psql",
    "--pull never api web",
    "--force-recreate",
    "--pull never edge",
  ].map((text) => calls.indexOf(text));
  assert(
    positions.every((position) => position >= 0),
    calls,
  );
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    calls,
  );
  assert(!calls.includes("down"));
  assert(!calls.includes("push"));
});

test("failed backup or migration prevents app replacement", (t) => {
  for (const failure of ["FAIL_BACKUP", "FAIL_MIGRATION"]) {
    const f = fixture(t, { [failure]: "1" });
    const result = f.run("up");
    assert.notEqual(result.status, 0);
    assert(!f.calls().includes("--pull never api web"));
    if (failure === "FAIL_BACKUP") assert(!f.calls().includes("run --rm"));
  }
});

test("dirty checkout cannot start production containers", (t) => {
  const f = fixture(t, { DIRTY_CHECKOUT: "1" });
  assert.notEqual(f.run("up").status, 0);
  assert(!f.calls().includes(" up "));
});

test("secrets are parsed as data, not shell; placeholders and duplicate keys are rejected", (t) => {
  const f = fixture(t);
  const original = readFileSync(f.envFile, "utf8");
  for (const invalid of ["$(touch EXECUTED)", "REPLACE_ME", "'quoted-secret'"]) {
    writeFileSync(f.envFile, original.replace("a".repeat(64), invalid));
    assert.notEqual(f.run("check").status, 0);
    assert.equal(f.calls(), "");
    assert(!existsSync(path.join(f.dir, "EXECUTED")));
  }
  writeFileSync(f.envFile, original + "DOMAIN=another.test\n");
  assert.notEqual(f.run("check").status, 0);
});

test("init refuses to overwrite credentials; rollback requires explicit schema acknowledgement", (t) => {
  const f = fixture(t);
  const before = readFileSync(f.envFile, "utf8");
  assert.notEqual(f.run("init", "portfolio.test").status, 0);
  assert.equal(readFileSync(f.envFile, "utf8"), before);
  assert.notEqual(f.run("rollback", "b".repeat(40)).status, 0);
  assert.equal(f.run("rollback", "b".repeat(40), "--schema-compatible").status, 0);
  assert(!f.calls().includes("run --rm"));
});

test("restore check only starts and removes the networkless scratch service", (t) => {
  const f = fixture(t);
  const dump = path.join(f.dir, "completed.dump");
  writeFileSync(dump, "fake backup");
  const result = f.run("restore-check", unix(dump));
  assert.equal(result.status, 0, result.stderr);
  assert(f.calls().includes("rm --stop --force restore-check"));
  assert(!f.calls().includes("exec -T db "));
});

test("frontend image includes the loading-budget plugin and its static model assets", () => {
  const ignore = read("frontend/.dockerignore");
  assert(ignore.includes("!scripts/flowentoBudget.js"));
  assert(ignore.includes("!src/**"));
  assert(read("frontend/Dockerfile").includes("scripts/flowentoBudget.js"));
  assert(read("frontend/vite.config.js").includes("flowentoBudgetPlugin()"));
  assert(existsSync(path.join(root, "frontend/src/assets/flowento/mirror-frame-2025-10.glb")));
  assert(existsSync(path.join(root, "frontend/src/assets/flowento/mirror-preview.png")));
});

test("SPA fallback ignores directories left by moved public assets", () => {
  const config = read("frontend/nginx.conf");
  assert.match(config, /location \/ \{ try_files \$uri \/index\.html; \}/);
  assert(!config.includes("try_files $uri $uri/"));
});
