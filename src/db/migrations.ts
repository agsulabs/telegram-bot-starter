import { readdir, readFile } from "node:fs/promises";
import { pool } from "./database.js";

const migrationsRoot = new URL("../../migrations/", import.meta.url);

export async function migrateDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [1_947_050_128]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const appliedResult = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
    const applied = new Set(appliedResult.rows.map((row) => row.version));
    const files = (await readdir(migrationsRoot))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(new URL(file, migrationsRoot), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [1_947_050_128]).catch(() => undefined);
    client.release();
  }
}
