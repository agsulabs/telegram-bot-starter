import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthenticationService } from "../auth/authenticationService.js";
import type { PlatformRepository } from "../db/platformRepository.js";
import type { MembershipService } from "../services/membershipService.js";
import {
  PublicationConflictError,
  PublicationNotFoundError,
  type PublicationService,
  publicationText,
} from "../services/publicationService.js";
import { TelegramAuthError } from "../auth/telegramInitData.js";

export interface ApiDependencies {
  authentication: Pick<AuthenticationService, "authenticate">;
  membership: Pick<MembershipService, "check">;
  publications: Pick<PublicationService, "list" | "get" | "create" | "update" | "removeDraft" | "publish">;
  repository: Pick<PlatformRepository,
    "recordActivity" | "listSubscribers" | "getSubscriber" | "getSubscriberActivity">;
  channelId: string | null;
  channelUrl: string | null;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }).end(body);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_768) throw new HttpError(413, "Request body is too large");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "Request body is not valid JSON"); }
}

function publicationId(path: string): { id: string; action: string | null } | null {
  const match = /^\/api\/admin\/publications\/(\d+)(?:\/(preview|publish))?$/.exec(path);
  return match ? { id: match[1], action: match[2] ?? null } : null;
}

export function createApiHandler(dependencies: ApiDependencies) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = (req.url ?? "/").split("?")[0];
    if (!path.startsWith("/api/")) return false;
    try {
      const auth = await dependencies.authentication.authenticate(req.headers.authorization);
      const isBootstrap = path === "/api/auth/bootstrap";
      const isRecheck = path === "/api/auth/recheck-membership";
      const membership = await dependencies.membership.check(auth.user.id, auth.identity.id, {
        force: isRecheck,
        adminBypass: auth.isAdmin,
      });

      if (isBootstrap && req.method === "POST") {
        await dependencies.repository.recordActivity(auth.user.id, "MINI_APP_OPEN");
        sendJson(res, 200, {
          profile: {
            telegramUserId: auth.user.telegramUserId,
            username: auth.user.username,
            firstName: auth.user.firstName,
            lastName: auth.user.lastName,
            languageCode: auth.user.languageCode,
            isPremium: auth.user.isPremium,
          },
          isAdmin: auth.isAdmin,
          membership,
          channelUrl: dependencies.channelUrl,
        });
        return true;
      }
      if (isRecheck && req.method === "POST") {
        await dependencies.repository.recordActivity(auth.user.id, "MEMBERSHIP_RECHECK", { authorized: membership.authorized });
        sendJson(res, 200, { membership, channelUrl: dependencies.channelUrl });
        return true;
      }

      if (!membership.authorized) throw new HttpError(403, "Active channel membership is required");
      if (!path.startsWith("/api/admin/")) throw new HttpError(404, "API endpoint not found");
      if (!auth.isAdmin) throw new HttpError(403, "Administrator access is required");

      if (path === "/api/admin/publications" && req.method === "GET") {
        sendJson(res, 200, { publications: await dependencies.publications.list() });
        return true;
      }
      if (path === "/api/admin/publications" && req.method === "POST") {
        const created = await dependencies.publications.create(auth.user.id, await readJson(req));
        await dependencies.repository.recordActivity(auth.user.id, "PUBLICATION_CREATED", { publicationId: created.id });
        sendJson(res, 201, { publication: created });
        return true;
      }

      const publicationRoute = publicationId(path);
      if (publicationRoute) {
        if (req.method === "GET" && publicationRoute.action === null) {
          sendJson(res, 200, { publication: await dependencies.publications.get(publicationRoute.id) });
          return true;
        }
        if (req.method === "GET" && publicationRoute.action === "preview") {
          const value = await dependencies.publications.get(publicationRoute.id);
          sendJson(res, 200, { preview: { title: value.title, body: value.body, text: publicationText(value.title, value.body) } });
          return true;
        }
        if (req.method === "PATCH" && publicationRoute.action === null) {
          const updated = await dependencies.publications.update(publicationRoute.id, await readJson(req));
          await dependencies.repository.recordActivity(auth.user.id, "PUBLICATION_UPDATED", { publicationId: updated.id });
          sendJson(res, 200, { publication: updated });
          return true;
        }
        if (req.method === "POST" && publicationRoute.action === "publish") {
          const published = await dependencies.publications.publish(publicationRoute.id);
          await dependencies.repository.recordActivity(auth.user.id, "PUBLICATION_PUBLISHED", { publicationId: published.id });
          sendJson(res, 200, { publication: published });
          return true;
        }
        if (req.method === "DELETE" && publicationRoute.action === null) {
          await dependencies.publications.removeDraft(publicationRoute.id);
          await dependencies.repository.recordActivity(auth.user.id, "PUBLICATION_DELETED", { publicationId: publicationRoute.id });
          sendJson(res, 200, { deleted: true });
          return true;
        }
      }

      if (path === "/api/admin/subscribers" && req.method === "GET") {
        if (!dependencies.channelId) throw new HttpError(503, "CHANNEL_ID is not configured");
        sendJson(res, 200, { subscribers: await dependencies.repository.listSubscribers(dependencies.channelId) });
        return true;
      }
      const subscriberMatch = /^\/api\/admin\/subscribers\/(\d+)(?:\/(activity))?$/.exec(path);
      if (subscriberMatch && req.method === "GET") {
        if (!dependencies.channelId) throw new HttpError(503, "CHANNEL_ID is not configured");
        if (subscriberMatch[2] === "activity") {
          sendJson(res, 200, { activity: await dependencies.repository.getSubscriberActivity(subscriberMatch[1]) });
        } else {
          const subscriber = await dependencies.repository.getSubscriber(subscriberMatch[1], dependencies.channelId);
          if (!subscriber) throw new HttpError(404, "Subscriber not found");
          sendJson(res, 200, { subscriber });
        }
        return true;
      }
      throw new HttpError(404, "API endpoint not found");
    } catch (error) {
      if (error instanceof TelegramAuthError) sendJson(res, 401, { error: error.message });
      else if (error instanceof HttpError) sendJson(res, error.status, { error: error.message });
      else if (error instanceof TypeError) sendJson(res, 400, { error: error.message });
      else if (error instanceof PublicationNotFoundError) sendJson(res, 404, { error: error.message });
      else if (error instanceof PublicationConflictError) sendJson(res, 409, { error: error.message });
      else sendJson(res, 500, { error: "The request could not be completed" });
      return true;
    }
  };
}
