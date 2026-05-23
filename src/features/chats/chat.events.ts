import type { Bot } from "grammy";
import { upsertConnectedChat } from "./chat.repository.js";

export function registerChatEvents(bot: Bot): void {
    bot.on("my_chat_member", async (ctx) => {
        const chat = ctx.myChatMember.chat;
        const status = ctx.myChatMember.new_chat_member.status;
        const now = new Date();

        await upsertConnectedChat({
            id: chat.id,
            type: chat.type,
            title: "title" in chat ? chat.title ?? null : null,
            username: "username" in chat ? chat.username ?? null : null,
            status,
            connectedAt: now,
            updatedAt: now,
        });
    });
}
