import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const ownerIdRaw = process.env.OWNER_ID?.trim();
const ownerId = ownerIdRaw ? Number(ownerIdRaw) : null;
if (ownerId !== null && (!Number.isSafeInteger(ownerId) || ownerId <= 0)) {
  throw new Error("OWNER_ID must be a positive integer");
}

const webappUrl = process.env.WEBAPP_URL?.trim() || null;
if (webappUrl) {
  let url: URL;
  try { url = new URL(webappUrl); } catch { throw new Error("WEBAPP_URL must be an HTTPS URL"); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("WEBAPP_URL must be an HTTPS URL without credentials");
  }
}

function optionalHttpsUrl(name: string): string | null {
  const value = process.env[name]?.trim() || null;
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an HTTPS URL`); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} must be an HTTPS URL without credentials`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

const channelId = process.env.CHANNEL_ID?.trim() || null;
if (channelId && !/^@?[A-Za-z0-9_]+$/.test(channelId) && !/^-\d+$/.test(channelId)) {
  throw new Error("CHANNEL_ID must be a numeric chat ID or @username");
}

const discussionChatIdRaw = process.env.DISCUSSION_CHAT_ID?.trim() || null;
const discussionChatId = discussionChatIdRaw === null ? null : Number(discussionChatIdRaw);
if (discussionChatId !== null && (!Number.isSafeInteger(discussionChatId) || discussionChatId >= 0)) {
  throw new Error("DISCUSSION_CHAT_ID must be a negative Telegram chat ID");
}

const configuredChannelUrl = optionalHttpsUrl("CHANNEL_URL");
const derivedChannelUrl = channelId?.startsWith("@")
  ? `https://t.me/${channelId.slice(1)}`
  : channelId && /^[A-Za-z][A-Za-z0-9_]+$/.test(channelId)
    ? `https://t.me/${channelId}`
    : null;

export const env = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),
  ownerId,
  channelId,
  channelUrl: configuredChannelUrl ?? derivedChannelUrl,
  discussionChatId,
  webappUrl,
  telegramInitDataMaxAgeSeconds: positiveInteger("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", 3_600),
  membershipCacheSeconds: positiveInteger("MEMBERSHIP_CACHE_SECONDS", 300),
};
