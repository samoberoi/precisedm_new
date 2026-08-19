# PreciseDM — Full Backend Backup & Restore Kit

Generated: 2026-08-19 (UTC) from the live production backend.

## What's in here

| File | Contents |
|---|---|
| `schema_migrations_concat.sql` | All 14 migrations concatenated, in order — the authoritative schema history |
| `policies.sql` | Every RLS policy on `public`, as CREATE POLICY statements |
| `indexes.sql` | Every index/unique constraint on `public` (includes the one-trial-per-user unique index) |
| `functions.sql` | All `public` database functions (`handle_new_user`, `has_role`, SEO helpers) |
| `triggers.sql` | All non-internal triggers on `public` |
| `data/*.csv` | Full row export of all 13 public tables |
| `data/auth_users.json` | All 52 auth accounts: **id, email, created_at, confirmed_at, last_sign_in, user metadata** |
| `data/auth_identities.json` | The matching email identity rows (provider/provider_id/identity_data) |

Row counts at export time: form_submissions 245, otp_codes 297, profiles 52,
receipts 7, seo_blog_posts 8, seo_settings 1, seo_tasks 25, subscriptions 57,
user_roles 59, auth.users 52.

## Restore order (into a remixed / fresh Cloud project)

1. **Schema** — apply the migrations (they already contain tables, grants, RLS, policies,
   functions, triggers). `policies.sql` / `indexes.sql` / `functions.sql` / `triggers.sql`
   are verification references, not a second source of truth.
2. **Disable the signup trigger temporarily.** `on_auth_user_created` auto-creates a
   `profiles` + `user_roles` row for every new auth user. Drop it before importing users,
   restore it after — otherwise the profile import collides.
3. **Auth users** — recreate each account with the Admin API, **passing the original `id`**
   so every foreign key in the CSVs still resolves:
   ```
   admin.createUser({ id, email, email_confirm: true, user_metadata })
   ```
   No passwords exist (email-OTP only), so nothing is lost by not copying password hashes.
   `auth_identities.json` is a fallback if identity rows need to be written directly.
4. **Public tables** in this order (FK-safe):
   `profiles` → `user_roles` → `subscriptions` → `receipts` → `form_submissions` →
   `otp_codes` → `seo_*`.
5. **Re-enable** `on_auth_user_created`.
6. **Secrets** — must be re-entered by hand in the new project (they are never exported):
   PAYPAL_CLIENT_ID, PAYPAL_SECRET, the 4 PayPal plan IDs, RESEND_API_KEY,
   GOOGLE_OAUTH_CLIENT_ID/SECRET, GOOGLE_SERVICE_ACCOUNT_JSON, GA4_PROPERTY_ID.
7. **Edge functions** — the 21 functions in `supabase/functions/` deploy with the code;
   re-point the PayPal webhook URL and the Google OAuth redirect URI at the new project.
8. **Verify before any cutover**: user count = 52, active subscriptions match,
   admin role present for neeraj@hyperrevamp.com and harvey@hyperrevamp.com,
   one OTP login end-to-end.

## Hard warnings

- Active sessions do **not** transfer. Every mobile user will be signed out once
  and must request a fresh OTP. With OTP-only auth that is recoverable — but it is a
  real, visible event for live users.
- The published mobile app binaries point at the **current** backend URL/anon key.
  A new backend requires a new app release; do not switch until that release is live.
- Keep the original project. Never delete it.
