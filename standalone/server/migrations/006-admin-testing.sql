-- Private account-scoped administrator preferences and nonredeemable test resources.
CREATE TABLE admin_account_settings (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL DEFAULT 'The Unnamed'
    CHECK(length(visitor_name) BETWEEN 2 AND 16 AND visitor_name NOT GLOB '*[^a-zA-Z0-9 _-]*'),
  testing_enabled INTEGER NOT NULL DEFAULT 0 CHECK(testing_enabled IN (0,1)),
  test_xp INTEGER NOT NULL DEFAULT 0 CHECK(test_xp BETWEEN 0 AND 9007199254740991),
  test_copper INTEGER NOT NULL DEFAULT 0 CHECK(test_copper BETWEEN 0 AND 9007199254740991),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Account IDs are pseudonymous audit actors; no email or session token is stored.
-- Keeping the actor without a cascading FK retains audit history on account erasure.
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(length(action) BETWEEN 1 AND 64),
  detail_json TEXT NOT NULL CHECK(json_valid(detail_json)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_admin_audit_actor ON admin_audit(user_id,created_at);
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE ON admin_audit
BEGIN SELECT RAISE(ABORT,'Administrator audit entries are immutable'); END;
CREATE TRIGGER admin_audit_no_delete BEFORE DELETE ON admin_audit
BEGIN SELECT RAISE(ABORT,'Administrator audit entries are immutable'); END;
