import { pool } from "../../db/database.js";
import type { ConnectedChat } from "./chat.types.js";

export async function upsertConnectedChat(chat: ConnectedChat): Promise<void> {
    await pool.query(
        `
      INSERT INTO connected_chats (
        id,
        type,
        title,
        username,
        status,
        connected_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        username = EXCLUDED.username,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
    `,
        [
            chat.id,
            chat.type,
            chat.title,
            chat.username,
            chat.status,
            chat.connectedAt,
            chat.updatedAt,
        ],
    );
}

export async function getConnectedChats(): Promise<ConnectedChat[]> {
    const result = await pool.query<{
        id: string;
        type: string;
        title: string | null;
        username: string | null;
        status: string;
        connected_at: Date;
        updated_at: Date;
    }>(`
    SELECT
      id,
      type,
      title,
      username,
      status,
      connected_at,
      updated_at
    FROM connected_chats
    ORDER BY updated_at DESC;
  `);

    return result.rows.map((row) => ({
        id: Number(row.id),
        type: row.type,
        title: row.title,
        username: row.username,
        status: row.status,
        connectedAt: row.connected_at,
        updatedAt: row.updated_at,
    }));
}
