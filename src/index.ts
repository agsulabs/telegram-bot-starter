import { createBot } from "./bot/createBot.js";
import { checkDatabase, closeDatabase } from "./db/database.js";
import { env } from "./config/env.js";

const bot = createBot();
bot.catch(() => console.error("Telegram update failed"));

let stopping = false;
const shutdown = () => {
  stopping = true;
  if (bot.isRunning()) void bot.stop();

};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  await checkDatabase();
  if (!env.webappUrl) console.warn("WEBAPP_URL is unset; Mini App button is disabled.");
  if (!stopping) {
    await bot.start({ onStart: () => {
      if (stopping) void bot.stop();
      else console.log("REFIJIN LABS bot started");
    } });
  }
} catch {
  console.error("Bot startup or polling failed. Check PostgreSQL, BOT_TOKEN and network access.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
