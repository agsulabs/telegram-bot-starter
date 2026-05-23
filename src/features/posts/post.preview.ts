import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { formatPostCaption, formatPreviewMeta } from "./post.formatter.js";
import type { PostDraft } from "./post.types.js";

function createPreviewKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("✅ Отправить", "post:publish")
        .text("✏️ Изменить", "post:edit");
}

export async function sendPostPreview(
    ctx: Context,
    draft: PostDraft,
): Promise<void> {
    const caption = formatPostCaption(draft);
    const previewMeta = formatPreviewMeta(draft);
    const previewText = [caption, previewMeta].filter(Boolean).join("\n\n");

    if (draft.values.imageFileId) {
        await ctx.replyWithPhoto(draft.values.imageFileId, {
            caption: previewText,
            parse_mode: "HTML",
            reply_markup: createPreviewKeyboard(),
        });

        return;
    }

    await ctx.reply(previewText, {
        parse_mode: "HTML",
        reply_markup: createPreviewKeyboard(),
    });
}
