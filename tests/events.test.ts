import assert from "node:assert/strict";
import { test } from "node:test";
import type { Update } from "grammy/types";
import { buildProjection, TelegramEventIngestor, type TelegramEventStore } from "../src/services/telegramEvents.js";

const scope = { channelId: "-1001", discussionChatId: -1002 };

test("discussion comments and individual reactions produce honest normalized projections", () => {
  const comment = buildProjection({ update_id: 1, message: {
    message_id: 5, date: 10, chat: { id: -1002, type: "supergroup", title: "Discussion" },
    from: { id: 42, is_bot: false, first_name: "Ada" }, text: "Useful",
    reply_to_message: {
      message_id: 4, date: 9, chat: { id: -1002, type: "supergroup", title: "Discussion" },
      is_automatic_forward: true,
      forward_origin: { type: "channel", chat: { id: -1001, type: "channel", title: "REFIJIN" }, message_id: 99, date: 9 },
    },
  } } as Update, scope);
  assert.equal(comment.type, "comment");
  if (comment.type === "comment") assert.equal(comment.relatedChannelMessageId, 99);

  const reaction = buildProjection({ update_id: 2, message_reaction: {
    chat: { id: -1001, type: "channel", title: "REFIJIN" }, message_id: 99, date: 11,
    user: { id: 42, is_bot: false, first_name: "Ada" }, old_reaction: [], new_reaction: [{ type: "emoji", emoji: "🔥" }],
  } } as Update, scope);
  assert.equal(reaction.type, "reaction_state");

  const aggregate = buildProjection({ update_id: 3, message_reaction_count: {
    chat: { id: -1001, type: "channel", title: "REFIJIN" }, message_id: 99, date: 12,
    reactions: [{ type: { type: "emoji", emoji: "🔥" }, total_count: 4 }],
  } } as Update, scope);
  assert.equal(aggregate.type, "reaction_count");
});

test("raw ingestion is idempotent and retains raw data when projection fails", async () => {
  const captured = new Set<number>();
  const finishes: string[] = [];
  const store: TelegramEventStore = {
    capture: async (update) => captured.has(update.update_id) ? null : (captured.add(update.update_id), String(update.update_id)),
    project: async () => { throw new Error("projection failed"); },
    finish: async (_id, status) => { finishes.push(status); },
  };
  const ingestor = new TelegramEventIngestor(store, scope);
  const update = { update_id: 3, channel_post: { message_id: 1, date: 1, chat: { id: -1001, type: "channel", title: "REFIJIN" }, text: "Post" } } as Update;
  assert.equal(await ingestor.ingest(update), "failed");
  assert.equal(await ingestor.ingest(update), "duplicate");
  assert.deepEqual(finishes, ["FAILED"]);
});

test("unsupported in-scope updates are preserved and marked ignored", async () => {
  const statuses: string[] = [];
  const store: TelegramEventStore = {
    capture: async () => "1",
    project: async (projection) => projection.type !== "none",
    finish: async (_id, status) => { statuses.push(status); },
  };
  const ingestor = new TelegramEventIngestor(store, scope);
  const update = { update_id: 4, channel_post: { message_id: 1, date: 1, chat: { id: -1001, type: "channel", title: "REFIJIN" }, text: "Post" } } as Update;
  assert.equal(await ingestor.ingest(update), "ignored");
  assert.deepEqual(statuses, ["IGNORED"]);
});
