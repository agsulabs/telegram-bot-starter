import type { Bot } from "grammy";

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    await ctx.reply("Hello! Telegram bot is running.");
  });
}
