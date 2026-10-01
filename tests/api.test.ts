import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { createApiHandler, type ApiDependencies } from "../src/webapp/api.js";

function dependencies(isAdmin: boolean, member = true): ApiDependencies {
  const appUser = {
    id: "1", telegramUserId: 42, username: "ada", firstName: "Ada", lastName: null,
    languageCode: "en", isPremium: false, createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(), lastSeenAt: new Date(0).toISOString(),
  };
  return {
    authentication: { authenticate: async () => ({
      user: appUser,
      identity: { id: 42, username: "ada", firstName: "Ada", lastName: null, languageCode: "en", isPremium: false },
      isAdmin,
    }) },
    membership: { check: async () => ({ authorized: member, status: member ? "member" : "left", checkedAt: new Date().toISOString(), source: "cache" as const }) },
    publications: {
      list: async () => [],
      get: async () => { throw new Error("unused"); },
      create: async () => { throw new Error("unused"); },
      update: async () => { throw new Error("unused"); },
      removeDraft: async () => undefined,
      publish: async () => { throw new Error("unused"); },
    },
    repository: {
      recordActivity: async () => undefined,
      listSubscribers: async () => [],
      getSubscriber: async () => null,
      getSubscriberActivity: async () => ({}),
    },
    channelId: "-1001",
    channelUrl: "https://t.me/refijinlabs",
  };
}

async function request(deps: ApiDependencies, path: string) {
  const handler = createApiHandler(deps);
  const req = { url: path, method: "GET", headers: { authorization: "tma test" } } as IncomingMessage;
  let status = 0;
  let responseBody = "";
  const res = {
    writeHead(code: number) { status = code; return this; },
    end(body?: string) { responseBody = body ?? ""; return this; },
  } as unknown as ServerResponse;
  await handler(req, res);
  return { status, body: JSON.parse(responseBody) as Record<string, unknown> };
}

test("non-admin cannot access an admin endpoint", async () => {
  const response = await request(dependencies(false), "/api/admin/publications");
  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Administrator access is required");
});

test("active admin can access publications", async () => {
  const response = await request(dependencies(true), "/api/admin/publications");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.publications, []);
});

test("non-member cannot access protected application endpoints", async () => {
  const response = await request(dependencies(false, false), "/api/admin/publications");
  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Active channel membership is required");
});
