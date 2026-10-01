import type { PlatformRepository } from "../db/platformRepository.js";

export interface TelegramMemberGateway {
  getChatMember(chatId: string, userId: number): Promise<{ status: string; is_member?: boolean }>;
}

export interface MembershipResult {
  authorized: boolean;
  status: string;
  checkedAt: string;
  source: "cache" | "telegram" | "admin_bypass";
}

export function isActiveMember(status: string, isMember?: boolean): boolean {
  return status === "creator"
    || status === "administrator"
    || status === "member"
    || (status === "restricted" && isMember === true);
}

export class MembershipService {
  constructor(
    private readonly repository: Pick<PlatformRepository, "getMembershipCache" | "saveMembership">,
    private readonly telegram: TelegramMemberGateway,
    private readonly channelId: string | null,
    private readonly cacheSeconds: number,
  ) {}

  async check(
    userId: string,
    telegramUserId: number,
    options: { force?: boolean; adminBypass?: boolean } = {},
  ): Promise<MembershipResult> {
    const now = new Date();
    if (options.adminBypass) {
      return { authorized: true, status: "admin_bypass", checkedAt: now.toISOString(), source: "admin_bypass" };
    }
    if (!this.channelId) throw new Error("CHANNEL_ID is not configured");

    if (!options.force) {
      const cached = await this.repository.getMembershipCache(userId, this.channelId);
      if (cached && now.getTime() - cached.checkedAt.getTime() <= this.cacheSeconds * 1_000) {
        return {
          authorized: cached.isActive,
          status: cached.status,
          checkedAt: cached.checkedAt.toISOString(),
          source: "cache",
        };
      }
    }

    const member = await this.telegram.getChatMember(this.channelId, telegramUserId);
    const active = isActiveMember(member.status, member.is_member);
    await this.repository.saveMembership(userId, this.channelId, member.status, active, "BOT_API", now);
    return { authorized: active, status: member.status, checkedAt: now.toISOString(), source: "telegram" };
  }
}
