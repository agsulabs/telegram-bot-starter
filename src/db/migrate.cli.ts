import { closeDatabase } from "./database.js";
import { migrateDatabase } from "./migrations.js";

try {
  await migrateDatabase();
  console.log("Database migrations: OK");
} catch {
  console.error("Database migration failed. No migration was partially applied.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
