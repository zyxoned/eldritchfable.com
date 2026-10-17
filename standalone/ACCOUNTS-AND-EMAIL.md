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

Current state: schema created and validated in a temporary SQLite database; no production accounts or mail sending enabled.
