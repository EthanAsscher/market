# Market — Pirate Trading Game 🏴‍☠️

Trade exotic commodities, build your fortune, and compete on the daily leaderboard.
A new market day every 24 hours.

## Quick Start

### 1. Create a Supabase Project (free)
1. Go to [supabase.com](https://supabase.com) → New Project
2. Pick a name + region (US East recommended)
3. Save your database password
4. Wait for project to finish provisioning

### 2. Set Up the Database
1. In Supabase dashboard → **SQL Editor** → New Query
2. Copy/paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** — this creates all tables, RLS policies, and seed data

### 3. Enable Google Auth (optional)
1. Supabase dashboard → **Authentication** → Providers → Google
2. Follow the instructions to set up Google OAuth
3. Add your redirect URL: `https://your-domain.com/game`

### 4. Get Your API Keys
1. Supabase dashboard → **Settings** → API
2. Copy `Project URL` and `anon public` key
3. Copy `service_role secret` key (keep this secret!)

### 5. Set Up Environment Variables
```bash
cp .env.local.example .env.local
```
Fill in your Supabase keys in `.env.local`

### 6. Install & Run
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 7. Deploy to Vercel
```bash
npm i -g vercel
vercel
```
Add your environment variables in Vercel dashboard → Settings → Environment Variables

### 8. Set Up the Market Tick
The market needs a cron job to update prices every ~15 seconds.

**Option A: Vercel Cron (included in vercel.json)**
- Runs every minute (Vercel free tier minimum)
- Add `CRON_SECRET` env var for security

**Option B: External Cron (better for 15s intervals)**
- Use [cron-job.org](https://cron-job.org) (free)
- Set it to POST to `https://your-domain.com/api/tick`
- Add header: `Authorization: Bearer YOUR_CRON_SECRET`
- Set interval to 15 seconds

---

## Architecture

```
Frontend:  Next.js 14 (React) → Vercel
Backend:   Supabase (Postgres + Auth + Realtime)
Cron:      Vercel Cron or external service
```

### Key Files
```
app/page.tsx              — Landing + auth
app/game/page.tsx         — Main game (protected)
app/api/trade/route.ts    — Server-side trade execution
app/api/claim/route.ts    — Daily claim endpoint
app/api/tick/route.ts     — Market tick (cron)
app/api/market/route.ts   — Price data + history
components/MarketGame.tsx — Game UI component
lib/constants.ts          — All game config
lib/engine.ts             — Shared formulas
lib/audio.ts              — Audio engine
lib/supabase.ts           — DB client + types
```

### Realtime
Commodity prices update live via Supabase Realtime subscriptions.
No polling needed — when the server tick updates a price, all connected
clients see it instantly.

---

## Customization

### Change Daily Claim Amount
Edit `DAILY_CLAIM` in `lib/constants.ts`

### Add/Remove Commodities
Edit `COMMODITIES` array in `lib/constants.ts`, then add matching
rows to the `commodities` table

### Adjust Market Volatility
Edit `NOISE_BASE`, `MICRO_TREND_CHANCE`, etc. in `lib/constants.ts`

### Add Events
Add to `EVENTS` array in `lib/constants.ts`

### Change Day Reset Time
Edit `TIMEZONE` in `lib/constants.ts` (default: America/New_York)

---

## Beta → v1 Roadmap
- [ ] Full chart system with price_snapshots
- [ ] Leaderboard with net worth rankings
- [ ] Bank (savings + loans) integration
- [ ] Rewarded ad for +50 ÐC/day
- [ ] Trade confirmations + cooldown
- [ ] Mobile PWA
- [ ] Social sharing ("My Day 47 NW")
- [ ] Day history / calendar view
