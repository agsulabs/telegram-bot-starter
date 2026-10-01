import assert from "node:assert/strict";
import { test } from "node:test";
import type { Publication } from "../src/db/platformRepository.js";
import { PublicationConflictError, PublicationService } from "../src/services/publicationService.js";

function draft(): Publication {
  return {
    id: "1", title: "Release", body: "Foundation is ready.", status: "DRAFT",
    telegramChatId: null, telegramMessageId: null, createdByUserId: "9",
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    publishedAt: null, publishAttemptedAt: null, lastPublishError: null,
  };
}

class FakePublicationRepository {
  value: Publication | null = draft();
  failMessage: string | null = null;
  async listPublications() { return this.value ? [this.value] : []; }
  async getPublication() { return this.value; }
  async createPublication(userId: string, title: string, body: string) {
    this.value = { ...draft(), createdByUserId: userId, title, body }; return this.value;
  }
  async updatePublication(_id: string, title: string, body: string) {
    if (!this.value) return null; this.value = { ...this.value, title, body }; return this.value;
  }
  async deleteDraft() { if (this.value?.status !== "DRAFT") return false; this.value = null; return true; }
  async claimDraftForPublishing() {
    if (this.value?.status !== "DRAFT") return null;
    this.value = { ...this.value, status: "PUBLISHING" }; return this.value;
  }
  async markPublished(_id: string, chatId: string, messageId: number) {
    if (!this.value) throw new Error("missing");
    this.value = { ...this.value, status: "PUBLISHED", telegramChatId: chatId, telegramMessageId: String(messageId), publishedAt: new Date().toISOString() };
    return this.value;
  }
  async markPublishFailed(_id: string, message: string) {
    if (this.value) this.value = { ...this.value, status: "DRAFT", lastPublishError: message };
    this.failMessage = message;
  }
  async setPublicationSyncError(_id: string, message: string) { this.failMessage = message; }
}

test("admin can create a validated publication draft", async () => {
  const repository = new FakePublicationRepository();
  const service = new PublicationService(repository, { sendMessage: async () => ({ message_id: 1 }), editMessageText: async () => true }, "-1001");
  const publication = await service.create("9", { title: "New", body: "Text" });
  assert.equal(publication.status, "DRAFT");
  assert.equal(publication.title, "New");
});
test("publication becomes PUBLISHED only after Telegram confirms", async () => {
  const repository = new FakePublicationRepository();
  let sent = 0;
  const service = new PublicationService(repository, {
    sendMessage: async () => { sent += 1; assert.equal(repository.value?.status, "PUBLISHING"); return { message_id: 77 }; },
    editMessageText: async () => true,
  }, "-1001");
  const publication = await service.publish("1");
  assert.equal(sent, 1);
  assert.equal(publication.status, "PUBLISHED");
  assert.equal(publication.telegramMessageId, "77");
});

test("Telegram failure returns a draft with a visible error", async () => {
  const repository = new FakePublicationRepository();
  const service = new PublicationService(repository, {
    sendMessage: async () => { throw new Error("secret Telegram response"); }, editMessageText: async () => true,
  }, "-1001");
  await assert.rejects(service.publish("1"), /Telegram rejected/);
  assert.equal(repository.value?.status, "DRAFT");
  assert.match(repository.failMessage ?? "", /Telegram rejected/);
});

test("a second publish cannot send a duplicate while processing or published", async () => {
  const repository = new FakePublicationRepository();
  repository.value = { ...draft(), status: "PUBLISHING" };
  let sent = 0;
  const service = new PublicationService(repository, {
    sendMessage: async () => { sent += 1; return { message_id: 1 }; }, editMessageText: async () => true,
  }, "-1001");
  await assert.rejects(service.publish("1"), PublicationConflictError);
  assert.equal(sent, 0);
});
