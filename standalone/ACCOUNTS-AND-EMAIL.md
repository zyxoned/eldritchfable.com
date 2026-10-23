# Eldritch Fable account and email security requirements

## Admin access
- Use /admin as an unadvertised navigation route, **not** a security boundary.
- Every admin API endpoint must enforce server-side role authorization.
- Create the first administrator through a local, audited provisioning command. Never permit public signup to assign admin roles.
- Store password hashes using a modern password KDF (Argon2id preferred), never plaintext.
- Use unpredictable, server-side sessions. Store only hashes of session tokens in SQLite. Cookies: HttpOnly, Secure, SameSite=Lax, limited lifetime.
- Rate-limit login and password-reset requests; use generic responses to prevent account enumeration.
- Require verified email before sensitive account actions. Expire and single-use verification/reset tokens.
- Enforce CSRF protection and strict allowed origins for cookie-authenticated state changes.
- Never include password hashes, tokens, live SQLite files or SMTP secrets in Git.

## Newsletter
- Customer registration does not automatically subscribe anyone to marketing.
- Subscription is a separate unchecked opt-in; record consent and confirmation timestamps.
- Use double opt-in before sending campaigns.
- Every message must identify the sender, include a valid postal address, and provide a working one-click unsubscribe where supported.
- Process unsubscribe immediately and retain suppression state.
- Only approved, verified, in-stock products and valid discounts may appear in campaigns.
- Weekly campaigns should be drafted and reviewed before sending until the fulfillment and pricing systems are trustworthy.
- Use your authenticated Proton business sending setup through a secure mail bridge/provider integration; do not place credentials in the repository or browser.
- Separate transactional account messages from marketing campaigns.

## Deployment gates
1. Implement and test account routes, roles, sessions, password reset, CSRF and throttling.
2. Configure mail delivery and verify SPF, DKIM and DMARC from actual received messages.
3. Test double opt-in, unsubscribe and suppression end-to-end with test addresses.
4. Validate backup/restore and HTTPS before accepting real accounts.
5. Confirm product availability and discounts against database before activating weekly sends.

## Implemented account behavior

- Registration and verification-mail creation commit together. Repeating registration does not change an existing password and returns the same public response.
- Verification links last 24 hours; reset links last 30 minutes. Replays, expired tokens, disabled accounts, and revoked sessions are rejected.
- `/api/auth/resend-verification` and `/api/auth/request-password-reset` return generic HTTP 202 responses. Each account/purpose has a one-minute cooldown. A pending valid message is reused rather than replaced by another queued copy.
- `/api/auth/change-password` requires the current password, invalidates outstanding password reset links, and signs out every session. Resetting a password also signs out every session.
- Login allows 30 attempts per client address and eight per normalized email per 15 minutes. The address header is accepted only from a loopback proxy when explicitly configured. Caddy must overwrite it; see DEPLOYMENT.md.
- Sessions last seven days. Password hashes retain compatibility with existing scrypt records. All admin authorization remains on the server.

## Transactional email queue

The worker claims each row inside a SQLite transaction, then performs SMTP outside the transaction. Claims expire after ten minutes. Known transient failures retry after 1, 5, 15, then 60 minutes, up to five attempts; expired tokens are discarded before sending. Permanent failures, malformed messages, and superseded tokens are not retried. Successful and terminal messages have their token payload removed.

A stable Message-ID follows the queue row across retries. SMTP does not provide exactly-once delivery: if the connection is lost during DATA, or a worker dies after SMTP accepts a message, its outcome is uncertain. Such rows are quarantined, not automatically resent. A customer can explicitly request a new verification/reset link after the cooldown. Queue summaries expose counts and fixed diagnostic codes only.

The worker defaults to dry run. SMTP sending requires `ELDRITCH_SEND_EMAIL=YES`. Use the supplied systemd timer as the single scheduler and remove older overlapping schedules after identifying them. Database claims also protect against accidental concurrent invocation.

## Public account APIs

GET `/api/auth/me` returns `{ user: null }` or public account fields. GET `/api/admin/status` requires an administrator session. POST JSON routes are `register`, `verify-email`, `resend-verification`, `login`, `logout`, `request-password-reset`, `reset-password`, and `change-password` under `/api/auth/`. Change-password takes `{ currentPassword, password }`; verification takes `{ token }`; reset takes `{ token, password }`. Browser state-changing requests require the exact configured Origin. Credentials and tokens are never returned by account lookup.
