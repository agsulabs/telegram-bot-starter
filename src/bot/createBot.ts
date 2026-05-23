import { Bot } from "grammy";
import { registerStartCommand } from "../commands/start.command.js";
import { env } from "../config/env.js";
import { registerPostMessageHandlers } from "../features/posts/post.messages.js";
import { registerCallbacks } from "./callbacks.js";
import { registerChatEvents } from "../features/chats/chat.events.js";
export function createBot(): Bot {
  const bot = new Bot(env.botToken);

  registerStartCommand(bot);
  registerCallbacks(bot);
  registerPostMessageHandlers(bot);
  registerChatEvents(bot);
  return bot;
}
