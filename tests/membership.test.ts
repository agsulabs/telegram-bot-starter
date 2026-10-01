import assert from "node:assert/strict";
import { test } from "node:test";
import { isActiveMember, MembershipService } from "../src/services/membershipService.js";

test("membership authorization recognizes only active Telegram states", () => {
  assert.equal(isActiveMember("creator"), true);
  assert.equal(isActiveMember("administrator"), true);
  assert.equal(isActiveMember("member"), true);
  assert.equal(isActiveMember("restricted", true), true);
  assert.equal(isActiveMember("restricted", false), false);
  assert.equal(isActiveMember("left"), false);
  assert.equal(isActiveMember("kicked"), false);
});
test("membership service caches checks and force refreshes", async () => {
  let cached: { status: string; isActive: boolean; checkedAt: Date } | null = null;
  let calls = 0;
  const repository = {
    getMembershipCache: async () => cached,
    saveMembership: async (_userId: string, _chatId: string, status: string, isActive: boolean) => {
      cached = { status, isActive, checkedAt: new Date() };
    },
  };
  const service = new MembershipService(repository, {
    getChatMember: async () => { calls += 1; return { status: calls === 1 ? "member" : "left" }; },
  }, "-1001", 300);

  assert.equal((await service.check("1", 42)).authorized, true);
  assert.equal((await service.check("1", 42)).source, "cache");
  assert.equal(calls, 1);
  assert.equal((await service.check("1", 42, { force: true })).authorized, false);
  assert.equal(calls, 2);
});

test("administrator bypass cannot be locked out by channel state", async () => {
  let telegramCalled = false;
  const service = new MembershipService({
    getMembershipCache: async () => null,
    saveMembership: async () => undefined,
  }, { getChatMember: async () => { telegramCalled = true; return { status: "left" }; } }, "-1001", 300);
  const result = await service.check("1", 42, { adminBypass: true });
  assert.equal(result.authorized, true);
  assert.equal(telegramCalled, false);
});
