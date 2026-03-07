---
description: How to onboard a new white-label food truck client (Firebase + Vercel)
---

# Onboard a New White-Label Food Truck Client

**Architecture:** One GitHub repo → many Vercel projects. Each client gets their own Firebase project (free tier) + Vercel project (free tier). No servers to manage. New client = ~30 minutes.

## Prerequisites

- Access to [console.firebase.google.com](https://console.firebase.google.com)
- Access to [vercel.com](https://vercel.com) (connected to GitHub repo `3dhuboz/hughesysque`)
- Access to pennywiseit.com.au admin panel

---

## Step 1: Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Name it: `client-name-foodtruck` (e.g. `daves-bbq`)
3. Disable Google Analytics (not needed)
4. Click **Create project**

### Enable Authentication

1. **Build → Authentication → Get started**
2. Enable **Email/Password** provider
3. Create the admin account:
   - Click **Add user**
   - Email: client's email
   - Password: strong temp password (client will change via Settings tab)

### Enable Firestore

1. **Build → Firestore Database → Create database**
2. Choose **Start in production mode**
3. Select region closest to client (e.g. `australia-southeast1`)
4. Click **Enable**

### Deploy Security Rules

1. Copy contents of `firestore.rules` from this repo
2. **Firestore → Rules tab** → paste and **Publish**

### Set Admin Role in Firestore

1. **Firestore → Data → Start collection** → Collection ID: `users`
2. Document ID: the admin's Firebase Auth UID (copy from Authentication → Users)
3. Add fields:
   - `name` (string): client's name
   - `email` (string): client's email
   - `role` (string): `admin`
   - `stamps` (number): `0`

### Get Firebase Config

1. **Project Settings (gear icon) → General → Your apps → Add app → Web**
2. Register app name (e.g. `Dave's BBQ Web`)
3. Copy the `firebaseConfig` object — you'll need all 6 values

---

## Step 2: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import from GitHub: `3dhuboz/hughesysque`
3. **Do NOT deploy yet** — set env vars first

### Set Environment Variables

In **Project Settings → Environment Variables**, add all of these:

| Variable | Value |
|----------|-------|
| `REACT_APP_FIREBASE_API_KEY` | from Firebase config |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | from Firebase config |
| `REACT_APP_FIREBASE_PROJECT_ID` | from Firebase config |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | from Firebase config |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | from Firebase config |
| `REACT_APP_FIREBASE_APP_ID` | from Firebase config |
| `REACT_APP_CLIENT_MODE` | `true` |
| `REACT_APP_ENABLED_APPS` | `foodtruck` |
| `REACT_APP_BRAND_NAME` | `Dave's BBQ` |
| `REACT_APP_BRAND_TAGLINE` | `Smoke & Fire Since 2019` |
| `REACT_APP_PRIMARY_COLOR` | `#f59e0b` (or client's brand colour) |

1. Click **Deploy** — build takes ~2 minutes

---

## Step 3: Set Custom Domain (Optional)

1. Vercel → Project → **Settings → Domains**
2. Add client's domain (e.g. `davesbq.com.au`)
3. Set DNS at registrar:
   - **A record**: `76.76.21.21` (Vercel)
   - Or **CNAME**: `cname.vercel-dns.com`
4. SSL auto-provisions within minutes

---

## Step 4: Seed Initial Menu (Optional)

Login to the client's site as admin → **Admin → Food Truck → Menu Manager** → add their menu items.

Or use Firebase Console → **Firestore → menu collection** → add documents manually.

---

## Step 5: Test & Hand Off

1. Visit the live URL → verify storefront loads with correct branding
2. Login with admin credentials → test Orders, Planner, Menu, Settings tabs
3. Change admin password via **Settings → Admin Password**
4. Send client: URL + email + temp password

---

## Step 6: Track in Client Projects

1. **pennywiseit.com.au → Admin → Client Projects** → create project
2. Record: Vercel URL, Firebase project ID, custom domain, status

---

## Quick Reference: Ongoing Management

- **Code updates**: Push to `master` → **all client Vercel projects auto-redeploy** from the same repo
- **Client-specific config**: Managed via Vercel env vars per project — no code changes needed
- **Data**: Each client's Firestore is completely isolated — no cross-contamination possible
- **Costs**: Firebase free tier covers ~50K reads/day and 20K writes/day — plenty for a food truck
- **Scaling**: Vercel free tier handles ~100GB bandwidth/month per project

## Each New Client Costs

- Firebase: **$0/month** (free tier)
- Vercel: **$0/month** (free tier, up to ~10 projects)
- Total infrastructure per client: **$0**
