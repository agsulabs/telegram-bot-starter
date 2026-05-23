import type { Bot } from "grammy";
import { t } from "../../i18n/t.js";
import type { PostBlock } from "./post.blocks.js";
import { publishPost } from "./post.publisher.js";
import { clearDraft } from "./post.draftStore.js";
import {
    getDraft,
    setCurrentBlock,
    toggleBlock,
} from "./post.draftStore.js";
import { getFirstSelectedBlock } from "./post.flow.js";
import { createPostBlocksKeyboard } from "./post.keyboard.js";

export function registerPostCallbacks(bot: Bot): void {
    bot.callbackQuery("post:add", async (ctx) => {
        await ctx.answerCallbackQuery();

        const i18n = t(ctx);
        const draft = getDraft(ctx.from.id);

        await ctx.reply(i18n.post.selectBlocks, {
            reply_markup: createPostBlocksKeyboard(ctx, draft.selectedBlocks),
        });
    });

    bot.callbackQuery(/^post:block:(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();

        const block = ctx.match[1] as PostBlock;
        const draft = toggleBlock(ctx.from.id, block);

        await ctx.editMessageReplyMarkup({
            reply_markup: createPostBlocksKeyboard(ctx, draft.selectedBlocks),
        });
    });

    bot.callbackQuery("post:continue", async (ctx) => {
        await ctx.answerCallbackQuery();

        const i18n = t(ctx);
        const draft = getDraft(ctx.from.id);
        const firstBlock = getFirstSelectedBlock(draft);

        if (!firstBlock) {
            await ctx.reply(i18n.post.selectBlocks);
            return;
        }

        setCurrentBlock(ctx.from.id, firstBlock);

        await ctx.reply(i18n.post.fields[firstBlock]);
    });
    bot.callbackQuery("post:publish", async (ctx) => {
        await ctx.answerCallbackQuery();

        const draft = getDraft(ctx.from.id);

        await publishPost(bot, draft);

        clearDraft(ctx.from.id);

        await ctx.reply("Публикация отправлена в канал.");
    });

    bot.callbackQuery("post:edit", async (ctx) => {
        await ctx.answerCallbackQuery();

        const i18n = t(ctx);
        const draft = getDraft(ctx.from.id);

        await ctx.reply(i18n.post.selectBlocks, {
            reply_markup: createPostBlocksKeyboard(ctx, draft.selectedBlocks),
        });
    });
}
