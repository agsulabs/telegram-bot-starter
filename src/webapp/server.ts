import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Api } from "grammy";
import { env } from "../config/env.js";
import { PlatformRepository } from "../db/platformRepository.js";
import { AuthenticationService } from "../auth/authenticationService.js";
import { MembershipService } from "../services/membershipService.js";
import { PublicationService } from "../services/publicationService.js";
import { createApiHandler, type ApiDependencies } from "./api.js";

const root = new URL(import.meta.url.endsWith(".ts") ? "../../webapp/" : "./public/", import.meta.url);
const routes: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

export function productionApiDependencies(): ApiDependencies {
  const telegram = new Api(env.botToken);
  const repository = new PlatformRepository();
  return {
    authentication: new AuthenticationService(repository, env.botToken, env.ownerId, env.telegramInitDataMaxAgeSeconds),
    membership: new MembershipService(repository, {
      getChatMember: (chatId, userId) => telegram.getChatMember(chatId, userId),
    }, env.channelId, env.membershipCacheSeconds),
    publications: new PublicationService(repository, {
      sendMessage: (chatId, text) => telegram.sendMessage(chatId, text),
      editMessageText: (chatId, messageId, text) => telegram.editMessageText(chatId, messageId, text),
    }, env.channelId),
    repository,
    channelId: env.channelId,
    channelUrl: env.channelUrl,
  };
}

export function createWebAppServer(dependencies: ApiDependencies = productionApiDependencies()): Server {
  const handleApi = createApiHandler(dependencies);
  return createServer(async (req, res) => {
    if (await handleApi(req, res)) return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const route = routes[(req.url || "/").split("?")[0]];
    if (!route) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(new URL(route[0], root));
      res.writeHead(200, {
        "Content-Type": route[1],
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self' https://web.telegram.org",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch { res.writeHead(500).end("Unable to load Mini App"); }
  });
}

function run(): void {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const server = createWebAppServer();
  server.on("error", () => { console.error("Mini App server failed to listen"); process.exitCode = 1; });
  server.listen(port, "0.0.0.0", () => console.log(`Mini App: http://localhost:${port}`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
