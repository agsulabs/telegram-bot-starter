import type { Pool, QueryResultRow } from "pg";
import type { Update, User } from "grammy/types";
import { pool } from "../db/database.js";
import type { TelegramIdentity } from "../auth/telegramInitData.js";
import { PlatformRepository } from "../db/platformRepository.js";
import { isActiveMember } from "./membershipService.js";

type JsonObject = Record<string, unknown>;

export interface EventScope {
  channelId: string | null;
  discussionChatId: number | null;
}

export interface EventMetadata {
  eventType: string;
  telegramUserId: number | null;
  chatId: number | null;
  messageId: number | null;
  relatedChannelMessageId: number | null;
  eventAt: Date | null;
}

export type EventProjection =
  | { type: "comment"; message: JsonObject; edited: boolean; author: TelegramIdentity | null; relatedChannelMessageId: number | null }
  | { type: "reaction_state"; reaction: JsonObject; actor: TelegramIdentity | null }
  | { type: "reaction_count"; reaction: JsonObject }
  | { type: "membership"; member: JsonObject; identity: TelegramIdentity }
  | { type: "user_seen"; identity: TelegramIdentity }
  | { type: "none" };

function telegramIdentity(user: User | undefined): TelegramIdentity | null {
  if (!user || user.is_bot) return null;
  return {
    id: user.id,
    username: user.username ?? null,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    languageCode: user.language_code ?? null,
    isPremium: user.is_premium === true,
  };
}

function eventEntry(update: Update): [string, JsonObject] {
  const entry = Object.entries(update).find(([key]) => key !== "update_id");
  return entry ? [entry[0], entry[1] as JsonObject] : ["unknown", {}];
}

function numericChatId(event: JsonObject): number | null {
  const chat = event.chat as JsonObject | undefined;
  return typeof chat?.id === "number" ? chat.id : null;
}

function channelMatches(event: JsonObject, channelId: string | null): boolean {
  if (!channelId) return false;
  const chat = event.chat as JsonObject | undefined;
  if (!chat) return false;
  if (String(chat.id) === channelId) return true;
  const username = typeof chat.username === "string" ? chat.username : null;
  return username !== null && channelId.replace(/^@/, "").toLowerCase() === username.toLowerCase();
}

export function isUpdateInScope(update: Update, scope: EventScope): boolean {
  const [type, event] = eventEntry(update);
  const chatId = numericChatId(event);
  const chat = event.chat as JsonObject | undefined;
  if (chat?.type === "private") return true;
  if (chatId !== null && chatId === scope.discussionChatId) return true;
  if (channelMatches(event, scope.channelId)) return true;
  if (type === "callback_query") {
    const message = event.message as JsonObject | undefined;
    const callbackChat = message?.chat as JsonObject | undefined;
    return callbackChat?.type === "private";
  }
  return false;
}

function relatedChannelMessageId(message: JsonObject): number | null {
  const reply = message.reply_to_message as JsonObject | undefined;
  const origin = reply?.forward_origin as JsonObject | undefined;
  return origin?.type === "channel" && typeof origin.message_id === "number" ? origin.message_id : null;
}

export function describeUpdate(update: Update): EventMetadata {
  const [eventType, event] = eventEntry(update);
  const message = eventType === "callback_query" ? event.message as JsonObject | undefined : event;
  const memberUser = (event.new_chat_member as JsonObject | undefined)?.user;
  const from = (eventType === "chat_member" ? memberUser : event.user ?? event.from ?? memberUser) as JsonObject | undefined;
  const eventDate = typeof event.date === "number"
    ? event.date
    : typeof message?.date === "number" ? message.date : null;
  return {
    eventType,
    telegramUserId: typeof from?.id === "number" ? from.id : null,
    chatId: numericChatId(event) ?? numericChatId(message ?? {}),
    messageId: typeof event.message_id === "number"
      ? event.message_id
      : typeof message?.message_id === "number" ? message.message_id : null,
    relatedChannelMessageId: message ? relatedChannelMessageId(message) : null,
    eventAt: eventDate === null ? null : new Date(eventDate * 1_000),
  };
}

export function buildProjection(update: Update, scope: EventScope): EventProjection {
  const [type, event] = eventEntry(update);
  if ((type === "message" || type === "edited_message") && numericChatId(event) === scope.discussionChatId) {
    return {
      type: "comment",
      message: event,
      edited: type === "edited_message",
      author: telegramIdentity(event.from as User | undefined),
      relatedChannelMessageId: relatedChannelMessageId(event),
    };
  }
  if (type === "message_reaction") {
    return { type: "reaction_state", reaction: event, actor: telegramIdentity(event.user as User | undefined) };
  }
  if (type === "message_reaction_count") return { type: "reaction_count", reaction: event };
  if (type === "chat_member" && channelMatches(event, scope.channelId)) {
    const member = event.new_chat_member as JsonObject | undefined;
    const identity = telegramIdentity(member?.user as User | undefined);
    if (member && identity) return { type: "membership", member: event, identity };
  }
  if (type === "message" || type === "edited_message" || type === "callback_query") {
    const identity = telegramIdentity(event.from as User | undefined);
    if (identity) return { type: "user_seen", identity };
  }
  return { type: "none" };
}

function reactionKey(value: JsonObject): string {
  if (value.type === "emoji" && typeof value.emoji === "string") return `emoji:${value.emoji}`;
  if (value.type === "custom_emoji" && typeof value.custom_emoji_id === "string") return `custom:${value.custom_emoji_id}`;
  if (value.type === "paid") return "paid";
  return `unknown:${JSON.stringify(value)}`;
}

export interface TelegramEventStore {
  capture(update: Update, metadata: EventMetadata): Promise<string | null>;
  project(projection: EventProjection): Promise<boolean>;
  finish(eventId: string, status: "PROCESSED" | "FAILED" | "IGNORED", error?: string): Promise<void>;
}

export class PostgresTelegramEventStore implements TelegramEventStore {
  private readonly users: PlatformRepository;
  constructor(private readonly database: Pool = pool, private readonly scope: EventScope) {
    this.users = new PlatformRepository(database);
  }

  async capture(update: Update, metadata: EventMetadata): Promise<string | null> {
    const result = await this.database.query<{ id: string } & QueryResultRow>(`
      INSERT INTO telegram_events (
        update_id, event_key, event_type, telegram_user_id, chat_id, message_id,
        related_channel_message_id, event_at, raw_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id
    `, [
      update.update_id,
      `update:${update.update_id}`,
      metadata.eventType,
      metadata.telegramUserId,
      metadata.chatId,
      metadata.messageId,
      metadata.relatedChannelMessageId,
      metadata.eventAt,
      JSON.stringify(update),
    ]);
    return result.rows[0]?.id ?? null;
  }

  async project(projection: EventProjection): Promise<boolean> {
    if (projection.type === "none") return false;
    if (projection.type === "user_seen") {
      await this.users.upsertUser(projection.identity);
      return true;
    }
    if (projection.type === "comment") {
      const message = projection.message;
      const chat = message.chat as JsonObject;
      const author = projection.author ? await this.users.upsertUser(projection.author) : null;
      const body = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : null;
      const created = new Date(Number(message.date) * 1_000);
      const edited = projection.edited && typeof message.edit_date === "number" ? new Date(message.edit_date * 1_000) : null;
      const reply = message.reply_to_message as JsonObject | undefined;
      await this.database.query(`
        INSERT INTO comments (
          discussion_chat_id, telegram_message_id, author_user_id, publication_id,
          related_channel_message_id, reply_to_message_id, body, created_at, edited_at
        ) VALUES (
          $1, $2, $3,
          (SELECT id FROM publications WHERE telegram_message_id = $4 AND telegram_chat_id = $5 LIMIT 1),
          $4, $6, $7, $8, $9
        )
        ON CONFLICT (discussion_chat_id, telegram_message_id) DO UPDATE SET
          author_user_id = EXCLUDED.author_user_id,
          publication_id = COALESCE(EXCLUDED.publication_id, comments.publication_id),
          related_channel_message_id = COALESCE(EXCLUDED.related_channel_message_id, comments.related_channel_message_id),
          reply_to_message_id = EXCLUDED.reply_to_message_id,
          body = EXCLUDED.body,
          edited_at = COALESCE(EXCLUDED.edited_at, comments.edited_at),
          last_observed_at = NOW()
      `, [chat.id, message.message_id, author?.id ?? null, projection.relatedChannelMessageId, this.scope.channelId, reply?.message_id ?? null, body, created, edited]);
      return true;
    }
    if (projection.type === "membership") {
      const event = projection.member;
      const chat = event.chat as JsonObject;
      const member = event.new_chat_member as JsonObject;
      const user = await this.users.upsertUser(projection.identity);
      const status = String(member.status);
      await this.users.saveMembership(
        user.id,
        String(chat.id),
        status,
        isActiveMember(status, member.is_member === true),
        "TELEGRAM_UPDATE",
        new Date(Number(event.date) * 1_000),
      );
      return true;
    }
    if (projection.type === "reaction_state") {
      const event = projection.reaction;
      const chat = event.chat as JsonObject;
      const user = projection.actor;
      if (user) await this.users.upsertUser(user);
      const actorChat = event.actor_chat as JsonObject | undefined;
      const actorKey = user ? `user:${user.id}` : typeof actorChat?.id === "number" ? `chat:${actorChat.id}` : null;
      if (!actorKey) return false;
      const client = await this.database.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM reaction_states WHERE chat_id = $1 AND telegram_message_id = $2 AND actor_key = $3`, [chat.id, event.message_id, actorKey]);
        const reactions = Array.isArray(event.new_reaction) ? event.new_reaction as JsonObject[] : [];
        for (const reaction of reactions) {
          await client.query(`
            INSERT INTO reaction_states (
              chat_id, telegram_message_id, publication_id, telegram_user_id,
              actor_chat_id, actor_key, reaction_key, reaction, observed_at
            ) VALUES (
              $1, $2,
              (SELECT id FROM publications WHERE telegram_chat_id = $3 AND telegram_message_id = $2 LIMIT 1),
              $4, $5, $6, $7, $8::jsonb, $9
            )
          `, [chat.id, event.message_id, this.scope.channelId, user?.id ?? null, actorChat?.id ?? null, actorKey, reactionKey(reaction), JSON.stringify(reaction), new Date(Number(event.date) * 1_000)]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
      return true;
    }
    const event = projection.reaction;
    const chat = event.chat as JsonObject;
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM reaction_counts WHERE chat_id = $1 AND telegram_message_id = $2", [chat.id, event.message_id]);
      const reactions = Array.isArray(event.reactions) ? event.reactions as JsonObject[] : [];
      for (const count of reactions) {
        const reaction = count.type as JsonObject;
        await client.query(`
          INSERT INTO reaction_counts (chat_id, telegram_message_id, reaction_key, reaction, total_count, observed_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        `, [chat.id, event.message_id, reactionKey(reaction), JSON.stringify(reaction), count.total_count, new Date(Number(event.date) * 1_000)]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    return true;
  }

  async finish(eventId: string, status: "PROCESSED" | "FAILED" | "IGNORED", error?: string): Promise<void> {
    await this.database.query(`
      UPDATE telegram_events
      SET processing_status = $2, processed_at = NOW(), processing_error = $3
      WHERE id = $1
    `, [eventId, status, error?.slice(0, 1_000) ?? null]);
  }
}

export class TelegramEventIngestor {
  constructor(private readonly store: TelegramEventStore, private readonly scope: EventScope) {}

  async ingest(update: Update): Promise<"duplicate" | "out_of_scope" | "processed" | "failed" | "ignored"> {
    if (!isUpdateInScope(update, this.scope)) return "out_of_scope";
    const eventId = await this.store.capture(update, describeUpdate(update));
    if (!eventId) return "duplicate";
    try {
      const projected = await this.store.project(buildProjection(update, this.scope));
      await this.store.finish(eventId, projected ? "PROCESSED" : "IGNORED");
      return projected ? "processed" : "ignored";
    } catch {
      await this.store.finish(eventId, "FAILED", "Normalized projection failed; raw event retained.");
      return "failed";
    }
  }
}
