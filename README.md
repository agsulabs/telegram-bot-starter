# REFIJIN LABS Telegram Platform

Telegram-бот на TypeScript/grammY, PostgreSQL и лёгкий Telegram Mini App. Telegram выступает единственным identity provider: отдельной регистрации, паролей и доверия к данным браузера нет.

## Архитектура

```text
Telegram channel / linked discussion / bot
                    │
                    ▼
             grammY polling
                    │
          raw telegram_events (JSONB)
                    │
                    ▼
 users · memberships · comments · reactions
                    │
                    ▼
     Mini App HTTP API ──► Publications ──► Telegram channel
```

- `src/bot/` — grammY bot, raw-first middleware и точный список `allowed_updates`.
- `src/auth/` — криптографическая проверка Telegram Mini App `initData`.
- `src/services/` — membership, публикации и нормализация Telegram updates.
- `src/db/` — PostgreSQL pool, repositories и migration runner.
- `src/webapp/` — API и статический HTTP server.
- `webapp/` — mobile-first Mini App без frontend-фреймворка.
- `migrations/` — последовательные SQL-миграции; существующие таблицы не удаляются.

## Требования и запуск

Node.js 22+, pnpm 10.14.0 и PostgreSQL.

```sh
pnpm install
pnpm db:migrate
pnpm dev
# Второй процесс для Mini App/API:
pnpm dev:webapp
```

`pnpm dev:webapp` слушает `PORT` (по умолчанию `3000`). Для Telegram нужен публичный HTTPS reverse proxy/tunnel к этому серверу. Раздавайте только Mini App и API, не корень репозитория.

Production:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm start
pnpm start:webapp
```

Миграции используют `schema_migrations`, PostgreSQL advisory lock и отдельную транзакцию на файл. Они не выполняют reset/drop и сохраняют прежнюю `connected_chats`, если она существует.

## Environment

Создайте `.env` локально из `.env.example`; `.env` не коммитится. Приложение не помещает токен или `initData` в логи.

| Переменная | Обязательность | Назначение |
| --- | --- | --- |
| `BOT_TOKEN` | да | BotFather token, только backend |
| `DATABASE_URL` | да | PostgreSQL connection string |
| `OWNER_ID` | рекомендуется | исходный server-side administrator Telegram ID |
| `CHANNEL_ID` | да для доступа/публикаций | numeric channel ID (`-100…`) или `@username` |
| `WEBAPP_URL` | да для Mini App button | публичный HTTPS URL этого Mini App/API |
| `CHANNEL_URL` | нужен при numeric/private `CHANNEL_ID` | HTTPS join/public URL, например `https://t.me/refijinlabs` или invite link |
| `DISCUSSION_CHAT_ID` | нужен для нормализации комментариев | numeric ID связанной supergroup (`-100…`) |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | нет | максимальный возраст initData, default `3600` |
| `MEMBERSHIP_CACHE_SECONDS` | нет | TTL server-side membership cache, default `300` |
| `PORT` | нет | HTTP port, default `3000` |

`CHANNEL_URL` и `DISCUSSION_CHAT_ID` добавляются вручную; приложение никогда не редактирует `.env`.

### Как получить IDs

1. Добавьте бота администратором канала и связанной discussion supergroup.
2. Укажите известный `CHANNEL_ID`.
3. Запустите `pnpm check:connections`. Команда делает `getMe`, `getChat(CHANNEL_ID)` и печатает numeric channel ID и Telegram `linked_chat_id`, если он доступен.
4. Скопируйте подтверждённый `linked_chat_id` в `DISCUSSION_CHAT_ID` и перезапустите процессы.

Не угадывайте ID и не привязывайте произвольную группу. Для публичного канала `CHANNEL_URL=https://t.me/<username>`. Для private channel используйте контролируемую invite link и учитывайте срок/лимиты ссылки.

## Telegram authentication и access gate

Mini App отправляет `Telegram.WebApp.initData` в `Authorization: tma <initData>`. Backend:

1. строит canonical data-check string;
2. проверяет HMAC-SHA256 через secret key `HMAC_SHA256(BOT_TOKEN, "WebAppData")`;
3. проверяет `auth_date` и maximum age;
4. upsert-ит Telegram user;
5. вычисляет admin status только server-side;
6. проверяет `getChatMember(CHANNEL_ID, telegram_user_id)` или свежий server-side cache.

Frontend `initDataUnsafe`, присланные роли, user IDs и membership flags не используются для авторизации. `OWNER_ID` и активные записи `admin_grants` независимы от обычной membership-роли; администратор не блокирует сам себя. Endpoint recheck принудительно обходит cache.

`/start` отдельно проверяет membership и показывает либо WebApp button, либо channel link + `Check subscription`. Backend повторяет проверку независимо, поэтому обход bot UI доступа не даёт.

## Mini App API

Все endpoints требуют валидный `tma` header.

- `POST /api/auth/bootstrap`
- `POST /api/auth/recheck-membership`
- `GET|POST /api/admin/publications`
- `GET|PATCH|DELETE /api/admin/publications/:id`
- `GET /api/admin/publications/:id/preview`
- `POST /api/admin/publications/:id/publish`
- `GET /api/admin/subscribers`
- `GET /api/admin/subscribers/:id`
- `GET /api/admin/subscribers/:id/activity`

Admin endpoints повторно проверяют admin authorization на каждом запросе. Обычный пользователь до успешной membership-проверки получает только безопасный bootstrap/access-gate response.

## Publications

Mini App поддерживает список, draft create/edit/preview/delete, publish и edit уже опубликованного текстового сообщения. Путь: Mini App → backend → PostgreSQL → Bot API → channel.

Публикация сначала атомарно переводится `DRAFT → PUBLISHING`. Только после успешного `sendMessage` записываются `PUBLISHED`, `telegram_message_id` и `published_at`. Повторный tap не отправляет второй пост. При Telegram failure запись возвращается в `DRAFT` с безопасным `last_publish_error`. Если Telegram уже принял сообщение, а PostgreSQL confirmation не сохранился, API явно сообщает о необходимости reconciliation и запрещает притворяться, что всё успешно.

Статусы schema заранее допускают `SCHEDULED`/`ARCHIVED`, но UI scheduling в этот build не реализует.

## Raw events и normalized data

Каждый update из разрешённой области сначала append-ится в `telegram_events.raw_payload JSONB` с unique `update_id/event_key`. Только после commit выполняется projection. Ошибка projection оставляет raw event со статусом `FAILED`, чтобы его можно было исследовать или перепроцессить позже. Неизвестный поддерживаемой областью update сохраняется как `IGNORED`.

Normalized данные создаются только при наличии подтверждённых полей Telegram:

- users из bot/Mini App activity;
- текущий membership cache и append-only membership observations;
- comments только из настроенной linked discussion group;
- связь comment → channel message/publication только когда `forward_origin` её предоставляет;
- individual reaction state только когда Telegram передал `user` или `actor_chat`;
- anonymous/aggregate reactions хранятся отдельно как counts, без выдуманного пользователя;
- Mini App first-party actions хранятся отдельно от raw Bot API events.

Bot polling явно запрашивает установленные grammY 1.43/Bot API update names:

`message`, `edited_message`, `channel_post`, `edited_channel_post`, `callback_query`, `chat_member`, `my_chat_member`, `message_reaction`, `message_reaction_count`.

## Telegram/BotFather permissions

- BotFather `/setcommands`: как минимум `start - Open REFIJIN LABS` и при необходимости owner command `publish_channel`.
- BotFather Main App/Menu Button: URL должен совпадать с `WEBAPP_URL`; bot также выставляет default Web App menu button при startup.
- Канал: bot administrator с правом публиковать и редактировать собственные posts.
- Discussion group: bot administrator и privacy/configuration, позволяющие получать нужные messages/edits.
- Для `chat_member`, `message_reaction`, `message_reaction_count` bot должен быть admin, а update types должны быть явно разрешены (код это делает).

`/publish_channel` сохранён как owner-only legacy publication button. Основной content workflow находится внутри Mini App.

## Ограничения Telegram API

- Bot API не предоставляет полный исторический export всех подписчиков канала.
- `Subscribers` показывает только людей, известных системе через bot, Mini App, membership checks и реально доставленные updates.
- Bot не получает произвольную историю, activity вне наших ресурсов или все удаления сообщений.
- Anonymous/aggregate reactions нельзя честно приписать конкретному пользователю.
- Связь discussion comment с channel post существует только когда Telegram передал достаточные relationship fields.
- Редактирование channel messages ограничено правами бота и правилами Bot API.

Проект не делает scraping, не обходит privacy/API limitations и не создаёт fake analytics.

## Проверки

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:connections
```

Automated tests мокают Telegram network calls и не публикуют реальные сообщения. `check:connections` — read-only, не запускает polling и ничего не отправляет.
