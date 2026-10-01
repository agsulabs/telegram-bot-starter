// Compatibility entrypoint for callers of the previous schema module.
// All schema changes now live in versioned SQL files under migrations/.
export { migrateDatabase } from "./migrations.js";
