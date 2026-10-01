import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  connectionTimeoutMillis: 10_000,
  query_timeout: 10_000,
});

// Avoid logging connection details or credentials from driver errors.
pool.on("error", () => console.error("PostgreSQL idle connection error"));

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
