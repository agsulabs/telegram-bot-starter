CREATE TABLE IF NOT EXISTS connected_chats (
  id BIGINT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  username TEXT,
  status TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  language_code TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_grants (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS channel_memberships (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  status TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE IF NOT EXISTS membership_observations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  status TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('BOT_API', 'TELEGRAM_UPDATE', 'ADMIN_BYPASS')),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS membership_observations_user_time_idx
  ON membership_observations (user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS membership_observations_chat_time_idx
  ON membership_observations (chat_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS publications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHING', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED')),
  telegram_chat_id TEXT,
  telegram_message_id BIGINT,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  publish_attempted_at TIMESTAMPTZ,
  last_publish_error TEXT,
  CONSTRAINT publications_published_link_check CHECK (
    status <> 'PUBLISHED'
    OR (telegram_chat_id IS NOT NULL AND telegram_message_id IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS publications_status_updated_idx
  ON publications (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS publications_telegram_message_idx
  ON publications (telegram_chat_id, telegram_message_id)
  WHERE telegram_chat_id IS NOT NULL AND telegram_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS telegram_events (
  id BIGSERIAL PRIMARY KEY,
  update_id BIGINT,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  telegram_user_id BIGINT,
  chat_id BIGINT,
  message_id BIGINT,
  related_channel_message_id BIGINT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_events_update_id_idx
  ON telegram_events (update_id) WHERE update_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_events_type_received_idx
  ON telegram_events (event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS telegram_events_user_received_idx
  ON telegram_events (telegram_user_id, received_at DESC)
  WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_events_chat_message_idx
  ON telegram_events (chat_id, message_id)
  WHERE chat_id IS NOT NULL AND message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  discussion_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  author_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  publication_id BIGINT REFERENCES publications(id) ON DELETE SET NULL,
  related_channel_message_id BIGINT,
  reply_to_message_id BIGINT,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  edited_at TIMESTAMPTZ,
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (discussion_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS comments_author_time_idx
  ON comments (author_user_id, created_at DESC) WHERE author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_publication_time_idx
  ON comments (publication_id, created_at DESC) WHERE publication_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_related_channel_message_idx
  ON comments (related_channel_message_id) WHERE related_channel_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reaction_states (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  publication_id BIGINT REFERENCES publications(id) ON DELETE SET NULL,
  telegram_user_id BIGINT,
  actor_chat_id BIGINT,
  actor_key TEXT NOT NULL,
  reaction_key TEXT NOT NULL,
  reaction JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  UNIQUE (chat_id, telegram_message_id, actor_key, reaction_key)
);

CREATE INDEX IF NOT EXISTS reaction_states_user_time_idx
  ON reaction_states (telegram_user_id, observed_at DESC) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reaction_states_message_idx
  ON reaction_states (chat_id, telegram_message_id);

CREATE TABLE IF NOT EXISTS reaction_counts (
  chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  reaction_key TEXT NOT NULL,
  reaction JSONB NOT NULL,
  total_count INTEGER NOT NULL CHECK (total_count >= 0),
  observed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (chat_id, telegram_message_id, reaction_key)
);

CREATE TABLE IF NOT EXISTS mini_app_activities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS mini_app_activities_user_time_idx
  ON mini_app_activities (user_id, occurred_at DESC);
