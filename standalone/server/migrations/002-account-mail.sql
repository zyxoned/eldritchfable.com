-- Preserve the old queue while adding ownership, scheduling and recovery state.
ALTER TABLE email_outbox RENAME TO email_outbox_legacy;
DROP INDEX IF EXISTS idx_email_outbox_status;
CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL CHECK(template IN ('verify_email','reset_password','newsletter_confirm')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  token_hash TEXT,
  dedupe_key TEXT,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  claim_id TEXT,
  lease_expires_at INTEGER,
  smtp_started_at INTEGER,
  last_error TEXT,
  provider_message_id TEXT
) STRICT;
INSERT INTO email_outbox(id,recipient,template,payload_json,status,attempts,created_at,sent_at)
  SELECT id,recipient,template,payload_json,
    CASE WHEN status='sending' THEN 'uncertain' ELSE status END,
    attempts,created_at,sent_at FROM email_outbox_legacy;
DROP TABLE email_outbox_legacy;
CREATE INDEX idx_email_outbox_status ON email_outbox(status,next_attempt_at,created_at);
CREATE UNIQUE INDEX idx_email_outbox_dedupe ON email_outbox(dedupe_key)
  WHERE status IN ('pending','sending','uncertain');
CREATE INDEX idx_account_tokens_user ON account_tokens(user_id,purpose);
CREATE TABLE account_mail_requests (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
  last_requested_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,purpose)
) STRICT;
