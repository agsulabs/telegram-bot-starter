import { createBot } from "./bot/createBot.js";

const bot = createBot();

bot.catch((error) => {
  console.error("Bot error:", error);
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

console.log("Telegram bot started");

await bot.start();
