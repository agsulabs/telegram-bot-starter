import { pool } from "./database.js";

export async function migrateDatabase(): Promise<void> {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS connected_chats (
      id BIGINT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      username TEXT,
      status TEXT NOT NULL,
      connected_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);
}
