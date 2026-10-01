import { InlineKeyboard, type Bot } from "grammy";
import { isOwner } from "../bot/access.js";
import { env } from "../config/env.js";

export function registerChannelCommand(bot: Bot): void {
  bot.command("publish_channel", async (ctx) => {
    if (ctx.chat.type !== "private" || !isOwner(ctx)) return;
    if (!env.channelId || !env.webappUrl) {
      await ctx.reply("Configure CHANNEL_ID and WEBAPP_URL before publishing.");
      return;
    }
    await ctx.api.sendMessage(env.channelId, "REFIJIN LABS\n\nComing soon.", {
      reply_markup: new InlineKeyboard().url(
        "Open REFIJIN LABS",
        `https://t.me/${ctx.me.username}?start=channel`,
      ),
    });
    await ctx.reply("Published to the channel.");
  });
}
