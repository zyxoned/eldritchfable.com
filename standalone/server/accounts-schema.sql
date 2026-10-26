-- Eldritch Fable account and newsletter schema (staging migration)
-- Requires SQLite 3.37+; apply to a backed-up staging database first.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS account_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_account_sessions_user ON account_sessions(user_id);
CREATE TABLE IF NOT EXISTS account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
  expires_at TEXT NOT NULL,
  used_at TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  subscribed_at TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  confirmation_token_hash TEXT,
  unsubscribe_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  content_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sending','sent','cancelled')),
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS newsletter_deliveries (
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_email TEXT NOT NULL REFERENCES newsletter_subscribers(email),
  status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','skipped')),
  provider_message_id TEXT,
  last_attempt_at TEXT,
  PRIMARY KEY(campaign_id,subscriber_email)
) STRICT;

-- Durable transactional email queue; no network send until configured.
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL CHECK(template IN ('verify_email','reset_password','newsletter_confirm')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status,created_at);
