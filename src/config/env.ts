import dotenv from "dotenv";

dotenv.config();

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error("BOT_TOKEN is required");
}

const ownerIdRaw = process.env.OWNER_ID;
const ownerId = ownerIdRaw ? Number(ownerIdRaw) : null;

if (ownerIdRaw && Number.isNaN(ownerId)) {
  throw new Error("OWNER_ID must be a number");
}

export const env = {
  botToken,
  ownerId,
};
