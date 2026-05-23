import type { Bot } from "grammy";
import { registerPostCallbacks } from "../features/posts/post.callbacks.js";
import {registerChatCallbacks} from "../features/chats/chat.callbacks.js";

export function registerCallbacks(bot: Bot): void {
    registerPostCallbacks(bot);
    registerChatCallbacks(bot);
}
