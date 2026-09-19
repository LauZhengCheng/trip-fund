# Trip Fund Ledger

A shared-expense PWA for group travel. One person acts as treasurer and records every
expense against a shared pool; everyone else gets a live, read-only view with comments.
Built for a real family trip to Indonesia and used in production by real users.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · vite-plugin-pwa ·
Supabase (Postgres / Auth / Storage / Realtime / Edge Functions) · Cloudflare Pages

---

## What this project demonstrates

- **Installable PWA** — works offline, installs to the home screen on iOS and Android
- **Real-time sync** — balances and entries update live across devices via Supabase Realtime
- **Web Push triggered from the database** — a two-part architecture (see below) that
  separates *detecting* an event from *signing and sending* the notification
- **Secrets handled properly** — VAPID private keys and cron secrets live in Supabase Vault,
  never in the repo; `.env` is gitignored and only the anon key ever reaches the client
- **Role-based access** — treasurer has write access, everyone else is read + comment only,
  enforced at the database layer rather than in the UI
- **Multi-currency entry** — record the amount actually received after exchange rather than
  guessing a rate

---

## Architecture note: how push notifications work

Firing a Web Push from a database change needs two independent pieces:

| Layer | Responsibility | How |
|---|---|---|
| **Database** | Detect that something happened and call out | `pg_cron` polls every minute, `pg_net` makes the HTTP request |
| **Edge Function** | Perform VAPID signing and actually deliver the push | Supabase Edge Function (`send-push`) |

**Why secrets live in Supabase Vault:** the original approach was
`alter database ... set app.settings.xxx`. That does not work on Supabase's managed
Postgres — the `postgres` role available in the SQL Editor is not permitted to change
database-level parameters. Supabase Vault is the supported path.

---

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Environment variables

Copy `.env.example` to `.env` and fill in your Supabase Project URL and anon key
(found under *Project Settings → API*). `.env` is gitignored.

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

> **Never** put the `service_role` key or the database password in this repository, in any
> chat log, or anywhere client-side. Only the anon key is safe to ship.

---

## Setting up Web Push

New entries and a nightly summary are pushed to everyone's phone.

**1. Generate a VAPID key pair** (one-off, runs locally, no account needed):

```bash
npx web-push generate-vapid-keys --json
```

Put the public key in `.env` as `VITE_VAPID_PUBLIC_KEY`. The private key goes in
`VAPID_PRIVATE_KEY` — no `VITE_` prefix, since that would expose it to the browser — and
it must never be committed.

**2. Run the "Web Push" section of `supabase/schema.sql`** in the Supabase SQL Editor,
then replace the placeholders below with real values and run them once:

```sql
select vault.create_secret('https://<your-project>.supabase.co', 'supabase_url');
select vault.create_secret('<PUSH_CRON_SECRET from .env>', 'push_cron_secret');
```

**3. Deploy the Edge Function** (needs the Supabase CLI):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy send-push --no-verify-jwt
npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  PUSH_CRON_SECRET=... \
  PUSH_CONTACT_EMAIL=<your email>
```

All four values come from `.env`. `PUSH_CONTACT_EMAIL` is required by the VAPID spec —
push services use it to contact the sender if they detect abuse, and it is never shown
to users.

**4. Enable notifications in the app** — tap *Turn on notifications* under the balance on
the Home screen.

> ⚠️ **On iOS you must "Add to Home Screen" first.** iOS only allows Web Push from a PWA
> installed as a home-screen icon, never from a Safari tab. This is an OS restriction; the
> app detects it and prompts accordingly.

---

## Project documentation

| Document | Contents |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Project conventions and ground rules |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Detailed design |
| [`docs/DAY1.md`](./docs/DAY1.md) | Day 1 build steps |
| [`docs/PROGRESS.md`](./docs/PROGRESS.md) | Progress tracker |
