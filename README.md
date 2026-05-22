# Telegram Bot Starter

A clean starter template for building Telegram bots with Node.js, TypeScript, pnpm, grammY and dotenv.

This project is intentionally minimal. It is designed as a reusable base for future Telegram bot projects.

## Tech Stack

- Node.js
- TypeScript
- pnpm
- grammY
- dotenv

## Project Structure

    src/
    ├── bot/
    │   └── createBot.ts
    ├── commands/
    │   └── start.command.ts
    ├── config/
    │   └── env.ts
    └── index.ts

## Requirements

- Node.js 20 or newer
- pnpm
- Telegram bot token from BotFather

## Environment Variables

Create a `.env` file in the project root:

    BOT_TOKEN=your_telegram_bot_token

Use `.env.example` as a template.

Important: never commit your `.env` file.

## Installation

    pnpm install

## Development

Start the bot locally:

    pnpm dev

Then open your bot in Telegram and send:

    /start

## Type Check

    pnpm typecheck

## Build

    pnpm build

## Production Start

    pnpm start

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Starts the bot locally with tsx |
| `pnpm typecheck` | Runs TypeScript type checking |
| `pnpm build` | Builds the project into `dist` |
| `pnpm start` | Starts the compiled bot from `dist` |

## Security

The Telegram bot token must stay private.

The `.env` file is ignored by Git and must not be pushed to GitHub.

Only `.env.example` should be committed.

## License

MIT
