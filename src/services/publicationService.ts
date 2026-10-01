import type { PlatformRepository, Publication } from "../db/platformRepository.js";

export interface TelegramPublicationGateway {
  sendMessage(chatId: string, text: string): Promise<{ message_id: number }>;
  editMessageText(chatId: string, messageId: number, text: string): Promise<unknown>;
}

export class PublicationConflictError extends Error {}
export class PublicationNotFoundError extends Error {}

export function publicationText(title: string, body: string): string {
  return `${title.trim()}\n\n${body.trim()}`;
}

export function validatePublicationInput(value: unknown): { title: string; body: string } {
  if (!value || typeof value !== "object") throw new TypeError("A JSON object is required");
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!title || title.length > 200) throw new TypeError("title must contain 1-200 characters");
  if (!body) throw new TypeError("body is required");
  if (publicationText(title, body).length > 4_096) {
    throw new TypeError("Publication text must not exceed Telegram's 4096-character limit");
  }
  return { title, body };
}

function safeTelegramError(): string {
  return "Telegram rejected the publication. Check bot channel permissions and try again.";
}

export class PublicationService {
  constructor(
    private readonly repository: Pick<PlatformRepository,
      "listPublications" | "getPublication" | "createPublication" | "updatePublication" |
      "deleteDraft" | "claimDraftForPublishing" | "markPublished" | "markPublishFailed" |
      "setPublicationSyncError">,
    private readonly telegram: TelegramPublicationGateway,
    private readonly channelId: string | null,
  ) {}

  list(): Promise<Publication[]> { return this.repository.listPublications(); }

  async get(id: string): Promise<Publication> {
    const publication = await this.repository.getPublication(id);
    if (!publication) throw new PublicationNotFoundError("Publication not found");
    return publication;
  }

  create(userId: string, input: unknown): Promise<Publication> {
    const { title, body } = validatePublicationInput(input);
    return this.repository.createPublication(userId, title, body);
  }

  async update(id: string, input: unknown): Promise<Publication> {
    const { title, body } = validatePublicationInput(input);
    const existing = await this.get(id);
    if (existing.status === "PUBLISHING") throw new PublicationConflictError("Publication is currently publishing");
    if (existing.status !== "DRAFT" && existing.status !== "PUBLISHED") {
      throw new PublicationConflictError("Publication cannot be edited in its current state");
    }
    if (existing.title === title && existing.body === body) return existing;
    if (existing.status === "PUBLISHED") {
      if (!existing.telegramChatId || !existing.telegramMessageId) {
        throw new PublicationConflictError("Published Telegram message link is missing");
      }
      await this.telegram.editMessageText(
        existing.telegramChatId,
        Number(existing.telegramMessageId),
        publicationText(title, body),
      );
    }
    try {
      const updated = await this.repository.updatePublication(id, title, body);
      if (!updated) throw new PublicationConflictError("Publication state changed; reload and try again");
      return updated;
    } catch (error) {
      if (existing.status === "PUBLISHED") {
        await this.repository.setPublicationSyncError(
          id,
          "Telegram was edited but the database update failed; manual reconciliation is required.",
        ).catch(() => undefined);
      }
      throw error;
    }
  }

  async removeDraft(id: string): Promise<void> {
    if (!await this.repository.deleteDraft(id)) {
      throw new PublicationConflictError("Only an existing draft can be deleted");
    }
  }

  async publish(id: string): Promise<Publication> {
    if (!this.channelId) throw new Error("CHANNEL_ID is not configured");
    const claimed = await this.repository.claimDraftForPublishing(id);
    if (!claimed) {
      const existing = await this.repository.getPublication(id);
      if (!existing) throw new PublicationNotFoundError("Publication not found");
      throw new PublicationConflictError(
        existing.status === "PUBLISHED" ? "Publication is already published" : "Publication is already being processed",
      );
    }

    let sent: { message_id: number };
    try {
      sent = await this.telegram.sendMessage(this.channelId, publicationText(claimed.title, claimed.body));
    } catch {
      await this.repository.markPublishFailed(id, safeTelegramError());
      throw new Error(safeTelegramError());
    }

    try {
      return await this.repository.markPublished(id, this.channelId, sent.message_id);
    } catch {
      await this.repository.setPublicationSyncError(
        id,
        `Telegram message ${sent.message_id} was sent, but confirmation could not be saved; manual reconciliation is required.`,
      ).catch(() => undefined);
      throw new Error("Telegram published the message, but the database confirmation failed; do not publish again");
    }
  }
}
