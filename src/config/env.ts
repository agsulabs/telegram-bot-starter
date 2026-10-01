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

export const env = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),
  ownerId,
  channelId: process.env.CHANNEL_ID?.trim() || null,
  webappUrl,
};
