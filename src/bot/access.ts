import type { Context } from "grammy";
import { env } from "../config/env.js";

export function isOwner(ctx: Context): boolean {
  return env.ownerId !== null && ctx.from?.id === env.ownerId;
}
