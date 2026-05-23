import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { t } from "../../i18n/t.js";
import { postBlocks, type PostBlock } from "./post.blocks.js";

export function createPostBlocksKeyboard(
    ctx: Context,
    selectedBlocks: PostBlock[],
): InlineKeyboard {
    const i18n = t(ctx);
    const keyboard = new InlineKeyboard();

    for (const block of postBlocks) {
        const isSelected = selectedBlocks.includes(block);
        const icon = isSelected ? "✅" : "⬜";

        keyboard
            .text(`${icon} ${i18n.post.blocks[block]}`, `post:block:${block}`)
            .row();
    }

    keyboard.text(i18n.post.continue, "post:continue");

    return keyboard;
}
