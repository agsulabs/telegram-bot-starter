import type { Bot } from "grammy";
import { getConnectedChats } from "./chat.repository.js";

export function registerChatCallbacks(bot: Bot): void {
    bot.callbackQuery("channels:list", async (ctx) => {
        await ctx.answerCallbackQuery();

        const chats = await getConnectedChats();

        if (chats.length === 0) {
            await ctx.reply("Подключённые каналы не найдены.");
            return;
        }

        await ctx.reply(
            chats
                .map((chat) =>
                    [
                        `📡 ${chat.title ?? "Без названия"}`,
                        `ID: ${chat.id}`,
                        `Type: ${chat.type}`,
                        `Username: ${chat.username ? `@${chat.username}` : "-"}`,
                        `Status: ${chat.status}`,
                    ].join("\n"),
                )
                .join("\n\n"),
        );
    });
}
