import { InlineKeyboard, type Bot } from "grammy";
import { env } from "../config/env.js";

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (!env.webappUrl) {
      await ctx.reply("Welcome to REFIJIN LABS.\n\nComing soon.");
      return;
    }
    await ctx.reply("Welcome to REFIJIN LABS.", {
      reply_markup: new InlineKeyboard().webApp("Open REFIJIN LABS", env.webappUrl),
    });
  });
}
