import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { repositoryDir } from "../../e2e/support/environment.js";

export const backupDir = path.join(repositoryDir, ".backups");
const restoreLabel = "landing-page.restore-token";

export function command(args, { input, output, timeout = 120_000 } = {}) {
  const result = spawnSync("docker", args, {
    cwd: repositoryDir,
    windowsHide: true,
    timeout,
    encoding: output === undefined ? "utf8" : undefined,
    stdio: [input === undefined ? "ignore" : "pipe", output ?? "pipe", "pipe"],
    input,
    maxBuffer: 8 * 1024 * 1024,
  });
  // Do not print inspect output, connection details, SQL or backup contents on failure.
  if (result.error || result.status !== 0) {
    throw new Error(
      `Docker ${args[0]} failed (${result.error?.code ?? result.status}); no existing database was reset.`,
    );
  }
  return result.stdout?.trim() ?? "";
}

export function sourceIdentity(container, source) {
  const labels = container.Config?.Labels ?? {};
  const variables = Object.fromEntries(
    (container.Config?.Env ?? []).map((entry) => {
      const split = entry.indexOf("=");
      return [entry.slice(0, split), entry.slice(split + 1)];
    }),
  );
  if (!container.State?.Running || labels["com.docker.compose.service"] !== "db") {
    throw new Error("Backup source must be the running owned PostgreSQL container.");
  }
  if (source === "development") {
    if (
      container.Name !== "/events_db" ||
      path.resolve(labels["com.docker.compose.project.working_dir"] ?? "") !==
        path.resolve(repositoryDir) ||
      path.resolve(labels["com.docker.compose.project.config_files"] ?? "") !==
        path.join(repositoryDir, "docker-compose.yml")
    ) {
      throw new Error("Development DB ownership does not match this checkout.");
    }
  } else if (source === "e2e") {
    if (
      labels["com.docker.compose.project"] !== "landing-page-e2e" ||
      labels["landing-page.e2e"] !== "true" ||
      variables.POSTGRES_DB !== "reaction_e2e" ||
      variables.POSTGRES_USER !== "e2e_user"
    ) {
      throw new Error("E2E DB ownership or identity does not match.");
    }
  } else throw new Error("SOURCE must be development or e2e.");
  if (!variables.POSTGRES_DB || !variables.POSTGRES_USER)
    throw new Error("DB identity is missing.");
  return { id: container.Id, database: variables.POSTGRES_DB, user: variables.POSTGRES_USER };
}

export function backupPath(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.dump$/.test(name) || name.includes("..")) {
    throw new Error("FILE must be a .dump basename inside .backups, not a path.");
  }
  return path.join(backupDir, name);
}

export function fileHash(file) {
  const hash = createHash("sha256");
  const descriptor = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let count;
    while ((count = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count));
    }
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

export function inspectBackup(name) {
  const file = backupPath(name);
  const manifest = JSON.parse(readFileSync(`${file}.json`, "utf8"));
  if (manifest.format !== 1 || manifest.file !== name || manifest.sha256 !== fileHash(file)) {
    throw new Error("Backup manifest/checksum mismatch; refusing restore.");
  }
  const descriptor = openSync(file, "r");
  try {
    const magic = Buffer.alloc(5);
    readSync(descriptor, magic, 0, 5, 0);
    if (magic.toString() !== "PGDMP") throw new Error("Not a PostgreSQL custom-format archive.");
  } finally {
    closeSync(descriptor);
  }
  return file;
}

function sql(identity, query) {
  return command(
    [
      "exec",
      "-i",
      identity.id,
      "psql",
      "-X",
      "-qAt",
      `--username=${identity.user}`,
      `--dbname=${identity.database}`,
      "--set=ON_ERROR_STOP=1",
    ],
    { input: `SET TIME ZONE 'UTC';\n${query}` },
  );
}

export function dumpDatabase(identity, prefix) {
  const version = Number(sql(identity, "SHOW server_version_num;"));
  if (version < 160000 || version >= 170000)
    throw new Error("This local rehearsal currently supports PostgreSQL 16 only.");
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const name = `${prefix}-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}.dump`;
  const file = backupPath(name);
  const partial = `${file}.partial`;
  const descriptor = openSync(partial, "wx", 0o600);
  try {
    command(
      [
        "exec",
        identity.id,
        "pg_dump",
        `--username=${identity.user}`,
        `--dbname=${identity.database}`,
        "--format=custom",
        "--no-owner",
        "--no-acl",
      ],
      { output: descriptor, timeout: 300_000 },
    );
  } catch (error) {
    closeSync(descriptor);
    unlinkSync(partial); // Only this run's incomplete artifact, never an existing backup.
    throw error;
  }
  closeSync(descriptor);
  if (existsSync(file)) throw new Error("Refusing to overwrite an existing backup.");
  renameSync(partial, file);
  writeFileSync(
    `${file}.json`,
    JSON.stringify(
      {
        format: 1,
        file: name,
        createdAt: new Date().toISOString(),
        postgresVersion: version,
        bytes: statSync(file).size,
        sha256: fileHash(file),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return name;
}

export function backup(source = "development") {
  const names = { development: "events_db", e2e: "landing-page-e2e-db-1" };
  if (!Object.hasOwn(names, source)) throw new Error("SOURCE must be development or e2e.");
  const [container] = JSON.parse(command(["inspect", names[source]]));
  return dumpDatabase(sourceIdentity(container, source), source);
}

export function assertRestoreOwned(container, token) {
  if (
    !token ||
    container.Config?.Labels?.[restoreLabel] !== token ||
    container.Name !== `/landing-page-restore-${token}` ||
    container.HostConfig?.NetworkMode !== "none" ||
    Object.keys(container.HostConfig?.PortBindings ?? {}).length !== 0
  ) {
    throw new Error("Refusing cleanup of a container not owned by this restore run.");
  }
}

export async function withRestoredDatabase(name, inspect) {
  const file = inspectBackup(name); // Validate before creating any container.
  const token = randomUUID();
  const id = command([
    "run",
    "--detach",
    "--name",
    `landing-page-restore-${token}`,
    "--label",
    `${restoreLabel}=${token}`,
    "--network",
    "none",
    "--memory",
    "768m",
    "--pids-limit",
    "128",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,nosuid,size=512m",
    "--mount",
    `type=bind,source=${file},target=/backup.dump,readonly`,
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--env",
    "POSTGRES_DB=restore_check",
    "--env",
    "POSTGRES_USER=restore_check",
    "postgres:16",
  ]);
  const identity = { id, database: "restore_check", user: "restore_check" };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        command([
          "exec",
          id,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          identity.user,
          "-d",
          identity.database,
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error("Isolated restore database did not become ready.");
    command(
      [
        "exec",
        id,
        "pg_restore",
        `--username=${identity.user}`,
        `--dbname=${identity.database}`,
        "--single-transaction",
        "--exit-on-error",
        "--no-owner",
        "--no-acl",
        "/backup.dump",
      ],
      { timeout: 300_000 },
    );
    return await inspect(identity);
  } finally {
    const [container] = JSON.parse(command(["inspect", id]));
    assertRestoreOwned(container, token);
    command(["rm", "--force", "--volumes", id]);
  }
}

export function databaseFingerprint(identity) {
  const tables = sql(
    identity,
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;",
  )
    .split("\n")
    .filter(Boolean);
  if (!tables.includes("schema_version") || !tables.includes("scores")) {
    throw new Error("Restored archive is missing the app's scores or migration version table.");
  }
  const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
  const fingerprint = {
    tables: {},
    sequences: {},
    schemaVersion: sql(identity, "SELECT version FROM public.schema_version;"),
  };
  for (const table of tables) {
    fingerprint.tables[table] = JSON.parse(
      sql(
        identity,
        `SELECT json_build_object('rows', count(*), 'digest', md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), ''))) FROM public.${quote(table)} t;`,
      ),
    );
  }
  const sequences = sql(
    identity,
    "SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;",
  )
    .split("\n")
    .filter(Boolean);
  for (const sequence of sequences) {
    fingerprint.sequences[sequence] = sql(
      identity,
      `SELECT last_value::text, is_called FROM public.${quote(sequence)};`,
    );
  }
  return fingerprint;
}

export async function rehearseRestore(name) {
  const first = await withRestoredDatabase(name, (identity) => ({
    fingerprint: databaseFingerprint(identity),
    roundTrip: dumpDatabase(identity, "rehearsal"),
  }));
  const second = await withRestoredDatabase(first.roundTrip, databaseFingerprint);
  if (JSON.stringify(first.fingerprint) !== JSON.stringify(second)) {
    throw new Error("Restore/dump/restore changed table contents or sequence state.");
  }
  const report = {
    checkedAt: new Date().toISOString(),
    sourceBackup: name,
    roundTripBackup: first.roundTrip,
    verified: true,
    ...second,
  };
  writeFileSync(
    `${backupPath(name)}.restore-${randomUUID()}.json`,
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return report;
}
