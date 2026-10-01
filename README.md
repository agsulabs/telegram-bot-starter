# REFIJIN LABS

Минимальный Telegram Bot на TypeScript/grammY, подключение PostgreSQL и статический Telegram Mini App. Экран приложения: **REFIJIN LABS — Coming soon.** Без платежей, регистрации и бизнес-логики.

## Структура

```text
src/
  bot/                 создание бота и проверка владельца
  commands/            /start и /publish_channel
  config/              чтение и проверка env
  db/                  PostgreSQL pool и сохранённая старая схема
  webapp/server.ts     отдельный HTTP-сервер публичных файлов
  check-connections.ts проверка PostgreSQL и Telegram без polling
  index.ts             запуск бота
webapp/                index.html, style.css, app.js
scripts/               копирование Mini App при сборке
tests/                тесты с имитацией Telegram API
```

## Настройка и запуск

Node.js 22+ и pnpm 10.14.0. Из корня репозитория:

```sh
pnpm install
# Только если .env ещё нет: cp .env.example .env
pnpm dev:webapp
```

Mini App доступен на `http://localhost:3000`. Бот и БД не нужны для просмотра страницы. Необязательная переменная `PORT` меняет порт HTTP-сервера.

В другом терминале: `pnpm dev` для запуска бота. Нужна доступная PostgreSQL. Не запускайте два polling-процесса с одним токеном.

В `.env`:

| Переменная | Назначение |
| --- | --- |
| `BOT_TOKEN` | Обязательный токен бота из BotFather |
| `OWNER_ID` | Числовой Telegram ID владельца; без него публикация отключена |
| `CHANNEL_ID` | ID канала или его @username для публикации |
| `DATABASE_URL` | Обязательная строка подключения PostgreSQL |
| `WEBAPP_URL` | Публичный HTTPS URL страницы Mini App |

Не заменяйте существующие рабочие значения. `.env` не коммитится и не раздаётся HTTP-сервером. Без `WEBAPP_URL` бот запускается, но `/start` показывает Coming soon без кнопки; публикация в канал отключена. Некорректный URL отклоняется.

## Публичный HTTPS и Telegram

Разместите **только содержимое `webapp/`** на статическом хостинге с HTTPS или запустите `pnpm start:webapp` за HTTPS reverse proxy. Для разработки можно использовать HTTPS-туннель к порту 3000. URL должен быть доступен с телефона и Desktop без локальной сети и дополнительного входа. Если туннель сменил адрес, обновите `WEBAPP_URL` и перезапустите бота. Для подпапки используйте URL с завершающим `/`.

В BotFather выберите существующего бота. Через `/setcommands` задайте `start - Open REFIJIN LABS` и удалите старые команды. Для кнопки в ответе `/start` отдельное создание приложения через `/newapp` не требуется. По желанию настройте `/setmenubutton`: текст `Open REFIJIN LABS`, URL тот же, что `WEBAPP_URL`.

Откройте личный чат с ботом → `/start` → **Open REFIJIN LABS**. Используется официальный Telegram WebApp SDK, `ready()`, `expand()` и Telegram theme CSS variables. Страница адаптивная; вне Telegram используется тёмная тема.

## Канал

Добавьте бота администратором канала с правом публикации. Укажите `OWNER_ID`, `CHANNEL_ID`, `WEBAPP_URL`. Владелец отправляет **в личный чат боту** `/publish_channel`. Каждый вызов отправляет новое сообщение в канал с URL-кнопкой.

Путь: канал → `https://t.me/<bot_username>?start=channel` → Start (если Telegram его предлагает) → ответ `/start` с WebApp-кнопкой. Username берётся из Telegram автоматически. Ту же ссылку можно вручную добавить в канал без команды.

WebApp-кнопки доступны в личных чатах; в канале используется обычная URL-кнопка, согласно [Telegram Bot API](https://core.telegram.org/bots/api#inlinekeyboardbutton). Документация: [Mini Apps](https://core.telegram.org/bots/webapps), [deep links](https://core.telegram.org/bots/features#deep-linking).

## PostgreSQL и проверка

Pool использует прежний `DATABASE_URL`. При старте выполняется `SELECT 1`. Существующие таблицы и данные не изменяются. `src/db/schema.ts` сохранён как описание прежней схемы `connected_chats`; автоматически миграция не запускается. Старый интерфейс списка чатов и запись событий подключения удалены, новая версия эту таблицу не использует.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:connections
pnpm start
# В отдельном процессе, если не используется статический хостинг:
pnpm start:webapp
```

`check:connections` выполняет `SELECT 1` и Telegram `getMe`, не отправляет сообщения и не забирает обновления. Тесты используют поддельные env и Telegram API, не обращаются к реальному каналу. `build` компилирует backend в `dist/` и копирует Mini App в `dist/webapp/public/`.

Перед production вручную проверьте открытие страницы в мобильном Telegram и Desktop, светлую/тёмную темы и переход из канала.
