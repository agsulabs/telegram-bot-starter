import { Bot } from "grammy";
import { registerStartCommand } from "../commands/start.command.js";
import { registerChannelCommand } from "../commands/channel.command.js";
import { env } from "../config/env.js";
import { PostgresTelegramEventStore, TelegramEventIngestor } from "../services/telegramEvents.js";
import { PlatformRepository } from "../db/platformRepository.js";

export const allowedUpdates = [
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
  "chat_member",
  "my_chat_member",
  "message_reaction",
  "message_reaction_count",
] as const;

export interface CreateBotOptions {
  eventIngestor?: Pick<TelegramEventIngestor, "ingest"> | null;
  isAdministrator?: (telegramUserId: number) => Promise<boolean>;
}

export function createBot(options: CreateBotOptions = {}): Bot {
  const bot = new Bot(env.botToken);
  const scope = { channelId: env.channelId, discussionChatId: env.discussionChatId };
  const eventIngestor = options.eventIngestor === undefined
    ? new TelegramEventIngestor(new PostgresTelegramEventStore(undefined, scope), scope)
    : options.eventIngestor;
  if (eventIngestor) {
    bot.use(async (ctx, next) => {
      await eventIngestor.ingest(ctx.update);
      await next();
    });
  }
  const repository = new PlatformRepository();
  const isAdministrator = options.isAdministrator ?? (async (telegramUserId) => (
    telegramUserId === env.ownerId || await repository.isTelegramAdmin(telegramUserId)
  ));
  registerStartCommand(bot, isAdministrator);
  registerChannelCommand(bot);
  return bot;
}
