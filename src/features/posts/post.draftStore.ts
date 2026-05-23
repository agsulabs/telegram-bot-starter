import type { PostBlock } from "./post.blocks.js";
import type { PostDraft } from "./post.types.js";

type UserId = number;

const drafts = new Map<UserId, PostDraft>();

export function getDraft(userId: UserId): PostDraft {
    const draft = drafts.get(userId);

    if (draft) return draft;

    const newDraft: PostDraft = {
        selectedBlocks: ["title", "text"],
        currentBlock: null,
        values: {},
    };

    drafts.set(userId, newDraft);
    return newDraft;
}

export function toggleBlock(userId: UserId, block: PostBlock): PostDraft {
    const draft = getDraft(userId);
    const selected = draft.selectedBlocks.includes(block);

    draft.selectedBlocks = selected
        ? draft.selectedBlocks.filter((item) => item !== block)
        : [...draft.selectedBlocks, block];

    drafts.set(userId, draft);
    return draft;
}

export function setCurrentBlock(
    userId: UserId,
    block: PostBlock | null,
): PostDraft {
    const draft = getDraft(userId);
    draft.currentBlock = block;

    drafts.set(userId, draft);
    return draft;
}

export function updateDraftValue(
    userId: UserId,
    block: PostBlock,
    value: string | string[],
): PostDraft {
    const draft = getDraft(userId);

    if (block === "image") {
        draft.values.imageFileId = String(value);
    }

    if (block === "reactions") {
        draft.values.reactions = Array.isArray(value)
            ? value
            : value.split(/\s+/).filter(Boolean);
    }

    if (block === "title") draft.values.title = String(value);
    if (block === "text") draft.values.text = String(value);
    if (block === "link") draft.values.link = String(value);

    drafts.set(userId, draft);
    return draft;
}
export function clearDraft(userId: number): void {
    drafts.delete(userId);
}
