import { Bot } from "grammy";
import { registerStartCommand } from "../commands/start.command.js";
import { env } from "../config/env.js";

export function createBot(): Bot {
  const bot = new Bot(env.botToken);

  registerStartCommand(bot);

  return bot;
}
