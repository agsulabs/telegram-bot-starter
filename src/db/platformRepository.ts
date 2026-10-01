import type { Pool, PoolClient, QueryResultRow } from "pg";
import { pool } from "./database.js";
import type { TelegramIdentity } from "../auth/telegramInitData.js";

export interface AppUser {
  id: string;
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

interface UserRow extends QueryResultRow {
  id: string;
  telegram_user_id: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language_code: string | null;
  is_premium: boolean;
  created_at: Date;
  updated_at: Date;
  last_seen_at: Date;
}

export interface MembershipCache {
  status: string;
  isActive: boolean;
  checkedAt: Date;
}

export interface Publication {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHING" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
  telegramChatId: string | null;
  telegramMessageId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  publishAttemptedAt: string | null;
  lastPublishError: string | null;
}

interface PublicationRow extends QueryResultRow {
  id: string;
  title: string;
  body: string;
  status: Publication["status"];
  telegram_chat_id: string | null;
  telegram_message_id: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  publish_attempted_at: Date | null;
  last_publish_error: string | null;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    languageCode: row.language_code,
    isPremium: row.is_premium,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  };
}

function mapPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    telegramChatId: row.telegram_chat_id,
    telegramMessageId: row.telegram_message_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
    publishAttemptedAt: row.publish_attempted_at?.toISOString() ?? null,
    lastPublishError: row.last_publish_error,
  };
}

export class PlatformRepository {
  constructor(private readonly database: Pool = pool) {}

  async upsertUser(identity: TelegramIdentity): Promise<AppUser> {
    const result = await this.database.query<UserRow>(`
      INSERT INTO users (
        telegram_user_id, username, first_name, last_name, language_code, is_premium
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        is_premium = EXCLUDED.is_premium,
        updated_at = NOW(),
        last_seen_at = NOW()
      RETURNING *
    `, [identity.id, identity.username, identity.firstName, identity.lastName, identity.languageCode, identity.isPremium]);
    return mapUser(result.rows[0]);
  }

  async isGrantedAdmin(userId: string): Promise<boolean> {
    const result = await this.database.query(
      "SELECT 1 FROM admin_grants WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    return result.rowCount === 1;
  }

  async isTelegramAdmin(telegramUserId: number): Promise<boolean> {
    const result = await this.database.query(`
      SELECT 1
      FROM admin_grants ag
      JOIN users u ON u.id = ag.user_id
      WHERE u.telegram_user_id = $1 AND ag.revoked_at IS NULL
    `, [telegramUserId]);
    return result.rowCount === 1;
  }

  async getMembershipCache(userId: string, chatId: string): Promise<MembershipCache | null> {
    const result = await this.database.query<{
      status: string;
      is_active: boolean;
      checked_at: Date;
    } & QueryResultRow>(`
      SELECT status, is_active, checked_at
      FROM channel_memberships
      WHERE user_id = $1 AND chat_id = $2
    `, [userId, chatId]);
    const row = result.rows[0];
    return row ? { status: row.status, isActive: row.is_active, checkedAt: row.checked_at } : null;
  }

  async saveMembership(
    userId: string,
    chatId: string,
    status: string,
    isActive: boolean,
    source: "BOT_API" | "TELEGRAM_UPDATE" | "ADMIN_BYPASS",
    observedAt = new Date(),
  ): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO channel_memberships (user_id, chat_id, status, is_active, checked_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, chat_id) DO UPDATE SET
          status = EXCLUDED.status,
          is_active = EXCLUDED.is_active,
          checked_at = EXCLUDED.checked_at,
          updated_at = NOW()
      `, [userId, chatId, status, isActive, observedAt]);
      await client.query(`
        INSERT INTO membership_observations (user_id, chat_id, status, is_active, source, observed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, chatId, status, isActive, source, observedAt]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordActivity(userId: string, activityType: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.database.query(`
      INSERT INTO mini_app_activities (user_id, activity_type, metadata)
      VALUES ($1, $2, $3::jsonb)
    `, [userId, activityType, JSON.stringify(metadata)]);
  }

  async listPublications(): Promise<Publication[]> {
    const result = await this.database.query<PublicationRow>(
      "SELECT * FROM publications ORDER BY updated_at DESC, id DESC LIMIT 200",
    );
    return result.rows.map(mapPublication);
  }

  async getPublication(id: string): Promise<Publication | null> {
    const result = await this.database.query<PublicationRow>("SELECT * FROM publications WHERE id = $1", [id]);
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async createPublication(userId: string, title: string, body: string): Promise<Publication> {
    const result = await this.database.query<PublicationRow>(`
      INSERT INTO publications (title, body, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [title, body, userId]);
    return mapPublication(result.rows[0]);
  }

  async updatePublication(id: string, title: string, body: string): Promise<Publication | null> {
    const result = await this.database.query<PublicationRow>(`
      UPDATE publications
      SET title = $2, body = $3, updated_at = NOW(), last_publish_error = NULL
      WHERE id = $1 AND status IN ('DRAFT', 'PUBLISHED')
      RETURNING *
    `, [id, title, body]);
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async deleteDraft(id: string): Promise<boolean> {
    const result = await this.database.query("DELETE FROM publications WHERE id = $1 AND status = 'DRAFT'", [id]);
    return result.rowCount === 1;
  }

  async claimDraftForPublishing(id: string): Promise<Publication | null> {
    const result = await this.database.query<PublicationRow>(`
      UPDATE publications
      SET status = 'PUBLISHING', publish_attempted_at = NOW(), last_publish_error = NULL, updated_at = NOW()
      WHERE id = $1 AND status = 'DRAFT'
      RETURNING *
    `, [id]);
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async markPublished(id: string, chatId: string, messageId: number): Promise<Publication> {
    const result = await this.database.query<PublicationRow>(`
      UPDATE publications
      SET status = 'PUBLISHED', telegram_chat_id = $2, telegram_message_id = $3,
          published_at = NOW(), updated_at = NOW(), last_publish_error = NULL
      WHERE id = $1 AND status = 'PUBLISHING'
      RETURNING *
    `, [id, chatId, messageId]);
    if (!result.rows[0]) throw new Error("Publication state changed before confirmation could be saved");
    return mapPublication(result.rows[0]);
  }

  async markPublishFailed(id: string, message: string): Promise<void> {
    await this.database.query(`
      UPDATE publications
      SET status = 'DRAFT', last_publish_error = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'PUBLISHING'
    `, [id, message.slice(0, 1_000)]);
  }

  async setPublicationSyncError(id: string, message: string): Promise<void> {
    await this.database.query(
      "UPDATE publications SET last_publish_error = $2, updated_at = NOW() WHERE id = $1",
      [id, message.slice(0, 1_000)],
    );
  }

  async listSubscribers(chatId: string): Promise<Record<string, unknown>[]> {
    const result = await this.database.query(`
      SELECT u.id, u.telegram_user_id, u.username, u.first_name, u.last_name,
             u.created_at, u.last_seen_at, cm.status AS membership_status,
             cm.is_active AS membership_active, cm.checked_at AS membership_checked_at
      FROM users u
      LEFT JOIN channel_memberships cm ON cm.user_id = u.id AND cm.chat_id = $1
      ORDER BY u.last_seen_at DESC
      LIMIT 200
    `, [chatId]);
    return result.rows;
  }

  async getSubscriber(userId: string, chatId: string): Promise<Record<string, unknown> | null> {
    const result = await this.database.query(`
      SELECT u.id, u.telegram_user_id, u.username, u.first_name, u.last_name,
             u.language_code, u.is_premium, u.created_at, u.updated_at, u.last_seen_at,
             cm.status AS membership_status, cm.is_active AS membership_active,
             cm.checked_at AS membership_checked_at
      FROM users u
      LEFT JOIN channel_memberships cm ON cm.user_id = u.id AND cm.chat_id = $2
      WHERE u.id = $1
    `, [userId, chatId]);
    return result.rows[0] ?? null;
  }

  async getSubscriberActivity(userId: string): Promise<Record<string, unknown>> {
    const [activities, comments, reactions, memberships] = await Promise.all([
      this.database.query(`SELECT activity_type, occurred_at, metadata FROM mini_app_activities WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 100`, [userId]),
      this.database.query(`SELECT discussion_chat_id, telegram_message_id, related_channel_message_id, body, created_at, edited_at FROM comments WHERE author_user_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId]),
      this.database.query(`SELECT chat_id, telegram_message_id, reaction, observed_at FROM reaction_states WHERE telegram_user_id = (SELECT telegram_user_id FROM users WHERE id = $1) ORDER BY observed_at DESC LIMIT 100`, [userId]),
      this.database.query(`SELECT chat_id, status, is_active, source, observed_at FROM membership_observations WHERE user_id = $1 ORDER BY observed_at DESC LIMIT 100`, [userId]),
    ]);
    return { activities: activities.rows, comments: comments.rows, reactions: reactions.rows, memberships: memberships.rows };
  }
}

export type TransactionClient = PoolClient;
