import type { AppUser, PlatformRepository } from "../db/platformRepository.js";
import type { TelegramIdentity } from "./telegramInitData.js";
import { readInitDataAuthorization, validateTelegramInitData } from "./telegramInitData.js";

export interface AuthenticatedUser {
  user: AppUser;
  identity: TelegramIdentity;
  isAdmin: boolean;
}
export class AuthenticationService {
  constructor(
    private readonly repository: Pick<PlatformRepository, "upsertUser" | "isGrantedAdmin">,
    private readonly botToken: string,
    private readonly ownerId: number | null,
    private readonly maxAgeSeconds: number,
  ) {}

  async authenticate(authorization: string | undefined): Promise<AuthenticatedUser> {
    const initData = readInitDataAuthorization(authorization);
    const identity = validateTelegramInitData(initData, this.botToken, this.maxAgeSeconds);
    const user = await this.repository.upsertUser(identity);
    const isAdmin = identity.id === this.ownerId || await this.repository.isGrantedAdmin(user.id);
    return { user, identity, isAdmin };
  }
}
