import type { Bot } from "grammy";
import { env } from "../../config/env.js";
import { formatPostCaption } from "./post.formatter.js";
import type { PostDraft } from "./post.types.js";

export async function publishPost(
    bot: Bot,
    draft: PostDraft,
): Promise<void> {
    if (!env.channelId) {
        throw new Error("CHANNEL_ID is required to publish posts");
    }

    const caption = formatPostCaption(draft);

    if (draft.values.imageFileId) {
        await bot.api.sendPhoto(env.channelId, draft.values.imageFileId, {
            caption,
            parse_mode: "HTML",
        });

        return;
    }

    await bot.api.sendMessage(env.channelId, caption, {
        parse_mode: "HTML",
    });
}
