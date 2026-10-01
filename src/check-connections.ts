import { createBot } from "./bot/createBot.js";
import { checkDatabase, closeDatabase, pool } from "./db/database.js";
import { env } from "./config/env.js";

try {
  await checkDatabase();
  console.log("PostgreSQL: OK");
  const migrations = await pool.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
  console.log(`Database migrations: ${migrations.rows.map((row) => row.version).join(", ") || "none"}`);
  const bot = createBot({ eventIngestor: null });
  await bot.init();
  console.log("Telegram getMe: OK (no polling or messages)");
  if (env.channelId) {
    const channel = await bot.api.getChat(env.channelId);
    console.log(`Telegram channel: OK (${channel.id})`);
    const channelMember = await bot.api.getChatMember(channel.id, bot.botInfo.id);
    console.log(`Bot channel status: ${channelMember.status}`);
    if (channelMember.status === "administrator") {
      console.log(`Bot channel permissions: post=${channelMember.can_post_messages === true}, edit=${channelMember.can_edit_messages === true}`);
    }
    if ("linked_chat_id" in channel && channel.linked_chat_id) {
      console.log(`Linked discussion chat ID: ${channel.linked_chat_id}`);
      const discussionMember = await bot.api.getChatMember(channel.linked_chat_id, bot.botInfo.id);
      console.log(`Bot discussion status: ${discussionMember.status}`);
    } else {
      console.log("Linked discussion chat ID: not reported by Telegram");
    }
  }
} catch {
  console.error("Connection check failed; check configuration and network access.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
