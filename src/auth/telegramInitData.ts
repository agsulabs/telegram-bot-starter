import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramIdentity {
  id: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isPremium: boolean;
}

export class TelegramAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramAuthError";
  }
}

function parseTelegramUser(raw: string | null): TelegramIdentity {
  if (!raw) throw new TelegramAuthError("Telegram user is missing");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new TelegramAuthError("Telegram user is invalid"); }
  if (!value || typeof value !== "object") throw new TelegramAuthError("Telegram user is invalid");
  const user = value as Record<string, unknown>;
  if (!Number.isSafeInteger(user.id) || Number(user.id) <= 0 || typeof user.first_name !== "string") {
    throw new TelegramAuthError("Telegram user is invalid");
  }
  return {
    id: Number(user.id),
    username: typeof user.username === "string" ? user.username : null,
    firstName: user.first_name,
    lastName: typeof user.last_name === "string" ? user.last_name : null,
    languageCode: typeof user.language_code === "string" ? user.language_code : null,
    isPremium: user.is_premium === true,
  };
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1_000),
): TelegramIdentity {
  if (!initData || initData.length > 16_384) throw new TelegramAuthError("Telegram initData is missing or too large");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new TelegramAuthError("Telegram signature is invalid");

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const supplied = Buffer.from(hash, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new TelegramAuthError("Telegram signature is invalid");
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : Number.NaN;
  if (!Number.isSafeInteger(authDate)) throw new TelegramAuthError("Telegram auth_date is invalid");
  if (authDate > nowSeconds + 30 || nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError("Telegram initData is stale");
  }
  return parseTelegramUser(params.get("user"));
}

export function readInitDataAuthorization(value: string | undefined): string {
  if (!value) throw new TelegramAuthError("Authorization is required");
  const match = /^tma\s+(.+)$/i.exec(value);
  if (!match) throw new TelegramAuthError("Authorization scheme must be tma");
  return match[1];
}
