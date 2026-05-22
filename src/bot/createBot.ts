import { Bot } from "grammy";
import { registerAdminCommand } from "../commands/admin.command.js";
import { registerHelpCommand } from "../commands/help.command.js";
import { registerStartCommand } from "../commands/start.command.js";
import { registerWhoamiCommand } from "../commands/whoami.command.js";
import { env } from "../config/env.js";

export function createBot(): Bot {
  const bot = new Bot(env.botToken);

  registerStartCommand(bot);
  registerHelpCommand(bot);
  registerWhoamiCommand(bot);
  registerAdminCommand(bot);

  return bot;
}
