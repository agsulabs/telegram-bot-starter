import type { Bot } from "grammy";
import { isOwner } from "../bot/access.js";

export function registerAdminCommand(bot: Bot): void {
  bot.command("admin", async (ctx) => {
    if (!isOwner(ctx)) {
      await ctx.reply("Access denied.");
      return;
    }

    await ctx.reply("Admin panel is available.");
  });
}
