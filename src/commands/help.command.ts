import type { Bot } from "grammy";

export function registerHelpCommand(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "Available commands:",
        "/start - start the bot",
        "/help - show help",
        "/whoami - show Telegram user and chat info",
        "/admin - owner-only command",
      ].join("\n"),
    );
  });
}
