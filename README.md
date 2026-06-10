# Thinkr

A connection-first social platform. People find each other by **how they think** — not by followers or likes. An idea-first feed, private "resonance" instead of public like counts, and **Thought Twin** matching that pairs you with the person who thinks most like you.

> _"The mortality impact of being socially disconnected is similar to that caused by smoking up to 15 cigarettes a day."_ — Dr. Vivek H. Murthy, U.S. Surgeon General, _Our Epidemic of Loneliness and Isolation_ (2023).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** — light/warm theme (flame `#F44A26`, amber `#F7B24C`, cream `#FBF3E8`, ink). Fraunces (display), Hanken Grotesk (body), Space Mono (labels).
- **Supabase** — Postgres, Auth (`@supabase/ssr`), Row-Level Security, Realtime
- **Deploy:** Vercel + Supabase

## Features

- **Login intro** — swipeable carousel explaining the app (with the cited Surgeon General study)
- **Onboarding survey** — the "thinking fingerprint" questionnaire + match preferences (gender, age, location, politics) → feeds the matching algorithm
- **18+ age gate** + Terms acceptance after login
- **Flux** — full-screen, swipe-snapping reel of thoughts
- **Ignite** — live realtime discussion rooms (debate / study / chill / open floor), reached from inside Flux
- **Daily Spark** — one shared prompt a day
- **Thought Twin** — cosine-similarity matching, gated by your survey preferences; request → both approve → a bond
- **Echo** — real-time DMs between bonded users, plus **circle group chats**
- **Gather** — real-world meetups with RSVPs (reached from inside Echo)
- **Circles** — topic communities with their own feeds
- **Resonance** — private signal that replaces likes. No follower counts. No public vanity metrics.

## Local development

1. **Install**
   ```bash
   npm install
   ```
2. **Environment** — copy the example and fill in your Supabase keys:
   ```bash
   cp .env.local.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```
   Both are safe for the browser (protected by RLS). **Never** put the `service_role` key here.
3. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Supabase setup

Run the SQL in the Supabase SQL editor **in order**:

1. `supabase/schema.sql` — base tables, RLS, the Daily Spark seed, profile trigger
2. `supabase/migrations/0001_messaging_and_connections.sql`
3. `supabase/migrations/0002_onboarding_survey_fields.sql`
4. `supabase/migrations/0003_security_hardening.sql`
5. `supabase/migrations/0004_age_gate_and_terms.sql`
6. `supabase/migrations/0005_ignite_gather_groups.sql`

In **Authentication → Providers → Email**, decide on **"Confirm email"**:
- **On** (recommended for production) — new users get a confirmation link; the signup screen shows a "check your email" prompt.
- **Off** — signup flows straight into onboarding.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the two environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Add your Vercel domain to Supabase: **Authentication → URL Configuration → Site URL / Redirect URLs**.
4. Deploy. (Build command `next build`, output is auto-detected.)

## Post-launch checklist

- **Enable leaked-password protection:** Supabase → Authentication → Policies → turn on the HaveIBeenPwned check.
- **Daily Spark:** seed a new `spark_prompts` row per day (the schema seeds the first few). Automate with a Supabase scheduled function.
- **Security:** profiles are readable only by signed-in users; emails/passwords live in Supabase's `auth` schema (bcrypt, never exposed via the API); political lean + match preferences are in an owner-only `match_prefs` table; RLS helper functions live in a non-public `private` schema.

## Project structure

```
app/
  (auth)/login, (auth)/signup     — auth + intro carousel
  onboarding/                     — fingerprint survey
  (app)/flux                      — the reel (home)
  (app)/spark, twin, circles      — daily spark, thought twin, circles
  (app)/echo, echo/[id]           — DMs (list + realtime thread)
  (app)/profile/[username], you   — profiles
components/                       — bottom-nav, top-bar, flux, compose-sheet, intro-carousel, age-gate, …
lib/supabase/                     — browser + server clients
lib/matching.ts                   — Thought Twin cosine similarity
proxy.ts                          — auth route guard (Next 16 renamed middleware → proxy)
supabase/                         — schema.sql + migrations/
```
