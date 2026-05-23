import { createBot } from "./bot/createBot.js";
import { closeDatabase } from "./db/database.js";
import { migrateDatabase } from "./db/schema.js";

await migrateDatabase();

const bot = createBot();

bot.catch((error) => {
  console.error("Bot error:", error);
});

process.once("SIGINT", async () => {
  bot.stop();
  await closeDatabase();
});

process.once("SIGTERM", async () => {
  bot.stop();
  await closeDatabase();
});

console.log("Telegram bot started");

await bot.start();
