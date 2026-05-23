import type { PostBlock } from "./post.blocks.js";
import { postBlocks } from "./post.blocks.js";
import type { PostDraft } from "./post.types.js";

export function getOrderedSelectedBlocks(draft: PostDraft): PostBlock[] {
    return postBlocks.filter((block) => draft.selectedBlocks.includes(block));
}

export function getFirstSelectedBlock(draft: PostDraft): PostBlock | null {
    return getOrderedSelectedBlocks(draft)[0] ?? null;
}

export function getNextBlock(
    draft: PostDraft,
    currentBlock: PostBlock,
): PostBlock | null {
    const blocks = getOrderedSelectedBlocks(draft);
    const currentIndex = blocks.indexOf(currentBlock);

    return blocks[currentIndex + 1] ?? null;
}
