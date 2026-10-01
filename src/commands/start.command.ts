import { InlineKeyboard, type Bot } from "grammy";
import { env } from "../config/env.js";

function memberIsActive(status: string, isMember?: boolean): boolean {
  return status === "creator" || status === "administrator" || status === "member"
    || (status === "restricted" && isMember === true);
}

async function hasAccess(bot: Bot, userId: number, isAdministrator: (userId: number) => Promise<boolean>): Promise<boolean> {
  if (await isAdministrator(userId)) return true;
  if (!env.channelId) return false;
  const member = await bot.api.getChatMember(env.channelId, userId);
  return memberIsActive(member.status, "is_member" in member ? member.is_member : undefined);
}

function accessKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (env.channelUrl) keyboard.url("Join REFIJIN LABS", env.channelUrl).row();
  return keyboard.text("Check subscription", "check_membership");
}

async function sendStartResult(
  bot: Bot,
  userId: number,
  isAdministrator: (userId: number) => Promise<boolean>,
  reply: (text: string, options?: object) => Promise<unknown>,
): Promise<void> {
  if (await hasAccess(bot, userId, isAdministrator)) {
    if (!env.webappUrl) {
      await reply("Welcome to REFIJIN LABS.\n\nThe Mini App is not configured yet.");
      return;
    }
    await reply("Welcome to REFIJIN LABS.", {
      reply_markup: new InlineKeyboard().webApp("Open REFIJIN LABS", env.webappUrl),
    });
    return;
  }
  const channelHint = env.channelUrl ? "Subscribe, then check again." : "The channel join link is not configured yet.";
  await reply(`REFIJIN LABS is available to channel subscribers.\n\n${channelHint}`, {
    reply_markup: accessKeyboard(),
  });
}

export function registerStartCommand(bot: Bot, isAdministrator: (userId: number) => Promise<boolean>): void {
  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private" || !ctx.from) return;
    await sendStartResult(bot, ctx.from.id, isAdministrator, (text, options) => ctx.reply(text, options));
  });

  bot.callbackQuery("check_membership", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.chat?.type !== "private") return;
    await sendStartResult(bot, ctx.from.id, isAdministrator, (text, options) => ctx.editMessageText(text, options));
  });
}
