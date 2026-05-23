import type { PostBlock } from "./post.blocks.js";

export type PostValues = {
    title?: string;
    text?: string;
    link?: string;
    imageFileId?: string;
    reactions?: string[];
};

export type PostDraft = {
    selectedBlocks: PostBlock[];
    currentBlock: PostBlock | null;
    values: PostValues;
};
