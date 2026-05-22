import { Bot } from "grammy";
import { registerStartCommand } from "../commands/start.command.js";
import { registerWhoamiCommand } from "../commands/whoami.command.js";
import { env } from "../config/env.js";

export function createBot(): Bot {
  const bot = new Bot(env.botToken);

  registerStartCommand(bot);
  registerWhoamiCommand(bot);

  return bot;
}
