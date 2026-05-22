import { Bot } from "grammy";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("BOT_TOKEN not found");
}

const bot = new Bot(token);

bot.command("start", (ctx) => {
    ctx.reply("Bot started");
});

bot.start();

console.log("Telegram bot started");
