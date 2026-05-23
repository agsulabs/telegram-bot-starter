import type { Context, NextFunction } from "grammy";

function isGroupChat(ctx: Context): boolean {
    return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function isCommand(text: string): boolean {
    return text.startsWith("/");
}

export async function ignoreGroupCommands(
    ctx: Context,
    next: NextFunction,
): Promise<void> {
    const text = ctx.message?.text;

    if (isGroupChat(ctx) && text && isCommand(text)) {
        return;
    }

    await next();
}
