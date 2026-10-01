import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { TelegramAuthError, validateTelegramInitData } from "../src/auth/telegramInitData.js";

const token = "123456:test-token";

function signedInitData(authDate: number, userId = 42): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAExample",
    user: JSON.stringify({ id: userId, first_name: "Ada", username: "ada", language_code: "en", is_premium: true }),
  });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

test("Telegram initData validation accepts a fresh official HMAC signature", () => {
  const identity = validateTelegramInitData(signedInitData(1_000), token, 300, 1_100);
  assert.deepEqual(identity, {
    id: 42, username: "ada", firstName: "Ada", lastName: null, languageCode: "en", isPremium: true,
  });
});
test("Telegram initData validation rejects an invalid signature", () => {
  const changed = signedInitData(1_000).replace("Ada", "Eve");
  assert.throws(() => validateTelegramInitData(changed, token, 300, 1_100), TelegramAuthError);
});

test("Telegram initData validation rejects stale data", () => {
  assert.throws(
    () => validateTelegramInitData(signedInitData(1_000), token, 60, 1_061),
    /stale/,
  );
});
