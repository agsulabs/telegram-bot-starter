import { createBot } from "./bot/createBot.js";
import { checkDatabase, closeDatabase } from "./db/database.js";

try {
  await checkDatabase();
  console.log("PostgreSQL: OK");
  await createBot().init();
  console.log("Telegram getMe: OK (no polling or messages)");
} catch {
  console.error("Connection check failed; check configuration and network access.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
