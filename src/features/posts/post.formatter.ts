import type { PostDraft } from "./post.types.js";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function formatPostCaption(draft: PostDraft): string {
    const parts: string[] = [];

    if (draft.values.title) {
        parts.push(`<b>${escapeHtml(draft.values.title)}</b>`);
    }

    if (draft.values.text) {
        parts.push(escapeHtml(draft.values.text));
    }

    if (draft.values.link) {
        parts.push(`🔗 ${escapeHtml(draft.values.link)}`);
    }

    return parts.join("\n\n");
}

export function formatPreviewMeta(draft: PostDraft): string {
    const reactions = draft.values.reactions;

    if (!reactions?.length) {
        return "";
    }

    return `<i>Реакции:</i> ${reactions.map(escapeHtml).join(" ")}`;
}
