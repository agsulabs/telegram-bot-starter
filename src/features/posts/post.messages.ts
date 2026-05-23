import type { Bot, Context } from "grammy";
import { t } from "../../i18n/t.js";
import type { PostBlock } from "./post.blocks.js";
import {
    getDraft,
    setCurrentBlock,
    updateDraftValue,
} from "./post.draftStore.js";
import { getNextBlock } from "./post.flow.js";
import { sendPostPreview } from "./post.preview.js";

async function moveNext(ctx: Context, currentBlock: PostBlock): Promise<void> {
    const i18n = t(ctx);
    const draft = getDraft(ctx.from!.id);
    const nextBlock = getNextBlock(draft, currentBlock);

    if (nextBlock) {
        setCurrentBlock(ctx.from!.id, nextBlock);
        await ctx.reply(i18n.post.fields[nextBlock]);
        return;
    }

    setCurrentBlock(ctx.from!.id, null);
    await sendPostPreview(ctx, getDraft(ctx.from!.id));
}

export function registerPostMessageHandlers(bot: Bot): void {
    bot.on("message:text", async (ctx) => {
        const draft = getDraft(ctx.from.id);
        const currentBlock = draft.currentBlock;

        if (!currentBlock) return;

        if (currentBlock === "image") {
            await ctx.reply("Отправьте фото, не текст.");
            return;
        }

        updateDraftValue(ctx.from.id, currentBlock, ctx.message.text);
        await moveNext(ctx, currentBlock);
    });

    bot.on("message:photo", async (ctx) => {
        const draft = getDraft(ctx.from.id);
        const currentBlock = draft.currentBlock;

        if (currentBlock !== "image") return;

        const photo = ctx.message.photo.at(-1);
        if (!photo) return;

        updateDraftValue(ctx.from.id, "image", photo.file_id);
        await moveNext(ctx, currentBlock);
    });
}
