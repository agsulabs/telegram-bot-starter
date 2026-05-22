import type { Bot } from "grammy";
import { isOwner } from "../bot/access.js";

export function registerWhoamiCommand(bot: Bot): void {
  bot.command("whoami", async (ctx) => {
    const userId = ctx.from?.id ?? "unknown";
    const chatId = ctx.chat?.id ?? "unknown";
    const chatType = ctx.chat?.type ?? "unknown";
    const owner = isOwner(ctx) ? "yes" : "no";

    await ctx.reply(
      [
        "Telegram info:",
        `User ID: ${userId}`,
        `Chat ID: ${chatId}`,
        `Chat type: ${chatType}`,
        `Owner: ${owner}`,
      ].join("\n"),
    );
  });
}
