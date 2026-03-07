# Infrastructure Strategy — All Apps
>
> Last updated: March 2026
> Problem solved: Vercel build minutes billing $100+/month

---

## The Stack (permanent, scaleable, ~$0-30/month total)

| Layer | Tool | Cost | Why |
|-------|------|------|-----|
| **Static hosting** | Cloudflare Pages | $0 | Unlimited builds, unlimited bandwidth, commercial OK |
| **Food truck data** | Firebase (per client) | $0 | Free tier covers any food truck's traffic |
| **Main platform backend** | Railway | ~$5-20/mo | Pay per actual usage, no cold starts |
| **Crons / background jobs** | Cloudflare Workers | $0 | 100K req/day free, replaces Vercel crons |
| **Domain / DNS** | Cloudflare (free plan) | $0 | Fastest DNS + free SSL everywhere |

---

## Per-App Migration Plan

### 1. Hughesys Que (food truck white-label)

- **Current**: Netlify (paused) → now Firebase + static React
- **Move to**: Cloudflare Pages ✅ `_redirects` already added
- **Action**: Create Cloudflare Pages project (see setup below)
- **Data**: Firebase project per client (free tier)
- **Build cmd**: `cd client && npm install && npm run build`
- **Output dir**: `client/build`

### 2. Street Meatz (food truck reference / live client)

- **Current**: Vercel static SPA + Firebase
- **Move to**: Cloudflare Pages ✅ `_redirects` already added
- **Action**: Create Cloudflare Pages project from same GitHub repo
- **Data**: Existing Firebase project (unchanged)

### 3. FoodTruck-App (old Street Meatz staging — DEAD)

- **Current**: Vercel (unused staging)
- **Action**: **Delete from Vercel dashboard immediately** — saves build minutes on every push

### 4. wi3d (unused project)

- **Current**: Vercel
- **Action**: **Delete from Vercel dashboard** — user confirmed it can go

### 5. SimpleWebsite (Pennywise white-label generator)

- **Current**: Vercel Vite SPA
- **Move to**: Cloudflare Pages ✅ `_redirects` added
- **Build cmd**: `npm install && vite build`
- **Output dir**: `dist`

### 6. socialai-studio — windsurf-project (MAIN SOCIALAI PLATFORM)

- **Current**: Vercel (Express serverless + React) — **#1 cause of build minutes** (most active dev)
- **Move to**:
  - Frontend → **Cloudflare Pages** ✅ `_redirects` added to `client/public/`
  - Backend → **Railway** (Express server, ~$5-20/month)
- **Biggest savings** — each commit = 3-5 min Vercel build

### 7. Penny Wise IT — main platform

- **Current**: Vercel (Express serverless + React)
- **Move to**: Frontend → Cloudflare Pages, Backend → Railway (same pattern as socialai-studio)
- **Can share the same Railway project** as socialai-studio if hosted together

### 8. Pickle Nick (white-label SocialAI client)

- **Current**: Vercel Vite SPA + hourly cron (`/api/publish-scheduled`)
- **Move to**: Cloudflare Pages ✅ `_redirects` added
- **Cron**: Migrate hourly publish job to a **Cloudflare Worker** with Cron Trigger (free tier)

### 9. Wires-R-Us (electrical contractor app)

- **Current**: Vercel Vite SPA + serverless functions + 5-min email poll cron
- **Move to**: Cloudflare Pages ✅ `_redirects` added
- **Cron**: Migrate 5-min email poll to **Cloudflare Worker** Cron Trigger (100K req/day free)

### 10. Gladstone BBQ (festival ticketing app — white-label)

- **Architecture**: Express + SQLite + Stripe webhooks + QR tickets + SendGrid/Twilio
- **Cannot be static** — needs persistent filesystem (SQLite) + persistent server URL (Stripe webhooks)
- **Deploy to**: **Railway** ✅ `railway.json` added, `.env.example` updated with brand vars
- **White-label vars**: `FESTIVAL_NAME`, `FESTIVAL_TAGLINE`, `FESTIVAL_PRIMARY_COLOR`
- **Cost per client**: ~$5-10/month on Railway

### 11. Autohue (white-label — TBD)

- **Status**: Local files not found — need to locate repo
- **Action**: Once found, assess architecture and apply appropriate pattern

---

## Cloudflare Pages Setup (per project, ~5 minutes)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages → Create application → Connect to Git**
2. Select the GitHub repo
3. Set build settings:

| Project | Build command | Output directory |
|---------|--------------|-----------------|
| Hughesys Que | `cd client && npm install && npm run build` | `client/build` |
| Street Meatz | `npm install && npm run build` | `dist` |
| SimpleWebsite | `npm install && vite build` | `dist` |
| Pickle Nick | `npm install && vite build` | `dist` |
| Penny Wise IT frontend | `cd client && npm install && npm run build` | `client/build` |

1. Add **Environment Variables** (Firebase keys, brand vars, etc.)
2. Click **Save and Deploy**
3. Custom domain: **Pages → Custom domains → Add domain** → point CNAME at Cloudflare

---

## Railway Setup for Penny Wise IT Backend

Railway replaces Vercel serverless for the Express backend.

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select `3dhuboz/Penny-Wise-IT`
3. Set **Root Directory**: leave blank (uses root `package.json`)
4. Set **Start command**: `node server/index.js`
5. Set environment variables (same as current Vercel env vars):
   - `NODE_ENV=production`
   - `MONGODB_URI=...`
   - `JWT_SECRET=...`
   - `ADMIN_EMAIL=...`
   - `ADMIN_PASSWORD=...`
   - `CLIENT_MODE=false` (main platform, not client mode)
   - All other API keys
6. Railway auto-provisions a URL: `https://penny-wise-it.up.railway.app`
7. Add custom domain: `api.pennywiseit.com.au` → point A/CNAME at Railway

Then update the Penny Wise IT frontend `client/src/api.js`:

```
REACT_APP_API_URL=https://api.pennywiseit.com.au/api
```

Set this in Cloudflare Pages environment variables.

---

## Vercel — What Stays

After migrating everything above, Vercel should only have:

- **Wires-R-Us** (if cron migration is deferred)
- **Pickle Nick** (if cron migration is deferred)

Monthly bill drops from **~$107** to **~$20 base** (or less if both are migrated).

---

## Estimated Final Monthly Costs

| Service | Cost |
|---------|------|
| Vercel Pro (base seat) | $20 (cancel if no projects remain) |
| Railway (Penny Wise IT backend) | ~$5-15 depending on usage |
| Firebase (per food truck client) | $0 (free tier) |
| Cloudflare Pages | $0 |
| Cloudflare Workers (crons) | $0 (free tier) |
| MongoDB Atlas | $0 (free tier) |
| **Total** | **~$20-35/month** |

vs. current ~$107/month = **saving ~$70-85/month**

---

## Priority Order (do these first for biggest impact)

1. **Disconnect FoodTruck-App from Vercel** — immediate, no code needed, saves build minutes
2. **Deploy Penny Wise IT frontend to Cloudflare Pages** — biggest build time savings
3. **Move Penny Wise IT backend to Railway** — removes Express serverless from Vercel
4. **Move Street Meatz to Cloudflare Pages** — easy, already has `_redirects`
5. **Move SimpleWebsite to Cloudflare Pages** — easy, already has `_redirects`
6. **Set up Hughesys Que on Cloudflare Pages** — easy, already has `_redirects`
7. **Migrate Pickle Nick cron to Cloudflare Workers** — more complex, do last
