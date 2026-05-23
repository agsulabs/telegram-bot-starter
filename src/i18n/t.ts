import type { Context } from "grammy";
import { messages, type Locale } from "./messages.js";

const supportedLocales: Locale[] = [
    "ru",
];

const defaultLocale: Locale = "ru";

function resolveLocale(languageCode?: string): Locale {
    if (!languageCode) {
        return defaultLocale;
    }

    const shortCode = languageCode.split("-")[0] as Locale;

    if (supportedLocales.includes(shortCode)) {
        return shortCode;
    }

    return defaultLocale;
}

export function getLocale(ctx: Context): Locale {
    return resolveLocale(ctx.from?.language_code);
}

export function t(ctx: Context) {
    return messages[getLocale(ctx)];
}
