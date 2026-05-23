import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { t } from "../i18n/t.js";

export function createMainMenuKeyboard(ctx: Context): InlineKeyboard {
    const i18n = t(ctx);

    return new InlineKeyboard()
        .text(i18n.menu.addPost, "post:add")
        .row()
        .text("📡 Подключённые каналы", "channels:list");
}
