import { Bot } from "grammy";
import { registerStartCommand } from "../commands/start.command.js";
import { registerChannelCommand } from "../commands/channel.command.js";
import { env } from "../config/env.js";

export function createBot(): Bot {
  const bot = new Bot(env.botToken);
  registerStartCommand(bot);
  registerChannelCommand(bot);
  return bot;
}
