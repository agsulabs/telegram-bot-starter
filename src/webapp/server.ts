import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

// Serve only these public assets; never expose the repository or .env.
const root = new URL(import.meta.url.endsWith(".ts") ? "../../webapp/" : "./public/", import.meta.url);
const routes: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const route = routes[(req.url || "/").split("?")[0]];
  if (!route) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL(route[0], root));
    res.writeHead(200, { "Content-Type": route[1], "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { res.writeHead(500).end("Unable to load Mini App"); }
});
server.on("error", () => { console.error("Mini App server failed to listen"); process.exitCode = 1; });
server.listen(port, "0.0.0.0", () => console.log(`Mini App: http://localhost:${port}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());
