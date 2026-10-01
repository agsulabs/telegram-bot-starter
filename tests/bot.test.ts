import assert from "node:assert/strict";
import { test } from "node:test";

process.env.BOT_TOKEN = "123456:test-token";
process.env.DATABASE_URL = "postgresql://localhost/test";
process.env.OWNER_ID = "42";
process.env.CHANNEL_ID = "-100123456";
process.env.WEBAPP_URL = "https://example.com/";
const { createBot } = await import("../src/bot/createBot.js");
const { env } = await import("../src/config/env.js");

async function dispatch(
  text: string,
  userId = 7,
  type: "private" | "group" = "private",
  membershipStatus = "member",
) {
  const bot = createBot({ eventIngestor: null, isAdministrator: async (id) => id === env.ownerId });
  bot.botInfo = { id: 123456, is_bot: true, first_name: "Test", username: "refijin_test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };
  const calls: { method: string; payload: any }[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (method === "getChatMember") return { ok: true, result: { status: membershipStatus, user: { id: userId, is_bot: false, first_name: "Visitor" } } } as any;
    return { ok: true, result: true } as any;
  });
  await bot.handleUpdate({ update_id: 1, message: {
    message_id: 1, date: 0, chat: type === "private" ? { id: userId, type } : { id: -1, type, title: "Test" },
    from: { id: userId, is_bot: false, first_name: "Visitor" }, text,
    entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
  } });
  return calls;
}

test("public /start, including channel payload, opens the configured WebApp", async () => {
  for (const text of ["/start", "/start channel"]) {
    const calls = await dispatch(text);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "getChatMember");
    assert.deepEqual(calls[1].payload.reply_markup.inline_keyboard[0][0], {
      text: "Open REFIJIN LABS", web_app: { url: env.webappUrl },
    });
  }
});
test("no WebApp button is sent in groups", async () => {
  assert.equal((await dispatch("/start", 7, "group")).length, 0);
});
test("non-member /start returns the subscription gate and retry action", async () => {
  const calls = await dispatch("/start", 7, "private", "left");
  assert.equal(calls.length, 2);
  assert.match(calls[1].payload.text, /channel subscribers/);
  assert.deepEqual(calls[1].payload.reply_markup.inline_keyboard.at(-1)[0], {
    text: "Check subscription", callback_data: "check_membership",
  });
});
test("only the owner in private chat can publish", async () => {
  assert.equal((await dispatch("/publish_channel")).length, 0);
  assert.equal((await dispatch("/publish_channel", 42, "group")).length, 0);
  const calls = await dispatch("/publish_channel", 42);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.chat_id, env.channelId);
  assert.deepEqual(calls[0].payload.reply_markup.inline_keyboard[0][0], {
    text: "Open REFIJIN LABS", url: "https://t.me/refijin_test_bot?start=channel",
  });
});
test("missing URL keeps /start available and blocks publication", async () => {
  const url = env.webappUrl;
  env.webappUrl = null;
  try {
    const start = await dispatch("/start");
    assert.equal(start[1].payload.reply_markup, undefined);
    const publish = await dispatch("/publish_channel", 42);
    assert.equal(publish.length, 1);
    assert.equal(publish[0].payload.chat_id, 42);
  } finally { env.webappUrl = url; }
});
