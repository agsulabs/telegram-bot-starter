import type { Bot } from "grammy";
import { isOwner } from "../bot/access.js";
import { t } from "../i18n/t.js";
import { createMainMenuKeyboard } from "../keyboards/mainMenu.keyboard.js";

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const i18n = t(ctx);

    if (!isOwner(ctx)) {
      await ctx.reply(i18n.common.accessDenied);
      return;
    }

    await ctx.reply(i18n.menu.main, {
      reply_markup: createMainMenuKeyboard(ctx),
    });
  });
}
