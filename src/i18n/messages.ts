import { az } from "./locales/az.js";
import { de } from "./locales/de.js";
import { en } from "./locales/en.js";
import { ru } from "./locales/ru.js";
import { tr } from "./locales/tr.js";
import { uk } from "./locales/uk.js";

export const messages = {
    ru
} as const;

export type Locale = keyof typeof messages;
