import { backup, rehearseRestore } from "./lib/database-backup.js";

try {
  const action = process.argv[2];
  if (process.argv.length !== 3)
    throw new Error("Use task db:backup or task db:restore:check FILE=<backup.dump>.");
  if (action === "backup") {
    console.info(`Backup saved in .backups/${backup(process.env.BACKUP_SOURCE || "development")}`);
    console.info(
      "Keep the .dump and .dump.json together. Local backups contain private data and are not encrypted.",
    );
  } else if (action === "restore-check") {
    const report = await rehearseRestore(process.env.BACKUP_FILE || "");
    console.info(
      `Restore verified: schema ${report.schemaVersion}, ${report.tables.scores.rows} scores; all public tables and sequence states match after a round trip.`,
    );
    console.info(
      "Only temporary restore containers/data were removed. Original databases and backup files are unchanged.",
    );
  } else throw new Error("Unknown backup command; no operation performed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
