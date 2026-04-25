# Hughesys Que

BBQ catering & cook-day pre-orders site for Macca's mob in Gladstone, QLD.

**Live:** https://hugheseysque.au

## Stack

- **Frontend:** React 19 + Vite + TypeScript SPA, Tailwind, React Router v7 (HashRouter), `client/`
- **Hosting:** Cloudflare Pages (auto-deploys on push to `master`)
- **Backend:** Cloudflare Pages Functions (TypeScript) under `functions/api/v1/*`
- **Database:** Cloudflare D1 (SQLite). Per-key rows in a `settings` table hold JSON config; orders/users/etc in their own tables. See `schema.sql`.
- **Email:** Resend (`hugheseysque.au` is verified there)
- **SMS:** ClickSend (preferred), MessageBird and Twilio wired as fallbacks
- **Payments:** Square — Catalog API + hosted payment links. Storefront submits orders as `Pending`; admin dispatches a Square invoice link from `/admin/orders`. The site does not collect card details directly.
- **Auth:** HMAC-signed admin sessions (`typ:'HQA'`) and customer magic-link sessions (`typ:'HQC'`, 30-day TTL). Secrets live in `settings.adminSessionSecret` / `settings.customerSessionSecret`. No Clerk.

## Local development

```sh
cd client
npm install
npm run dev          # SPA only on localhost:5173
npm run typecheck    # tsc --noEmit
npm run build        # vite build → client/dist
```

For full-stack dev (Functions + D1 against the SPA build):

```sh
npm install -g wrangler
cd client && npm run build
wrangler pages dev client/dist --d1=DB
```

## Deploy

`git push origin master` → Cloudflare Pages picks it up via `.github/workflows/deploy.yml` and runs `npm install` → `npm run typecheck` → `npm run build` → `wrangler pages deploy`. Watch progress in the Cloudflare dashboard.

## Where secrets live

- **Cloudflare Pages env vars** (set via dashboard, not in this repo): `SQUARE_WEBHOOK_SIGNATURE_KEY`, optional `ADMIN_API_KEY` for server-to-server scripts, plus any provider creds you'd rather not put in D1. Wrangler binding for `DB` (D1).
- **D1 `settings` JSON** (admin UI manages most of these): Square access token + location ID, Resend API key, ClickSend username/key/sender, admin email, business address, host-rewards config, etc. Sensitive fields like `adminSessionSecret`, `customerSessionSecret`, and `adminPasswordRecord` are server-managed and stripped from the GET response for non-admins.

## Rollback

Cloudflare Pages keeps every deploy. To roll back: dashboard → Pages → `hughesys-que` → Deployments → ⋯ on the good deploy → **Rollback**. Instant. Don't `git revert`-and-push when the dashboard click is faster.

## Backups

Admin-triggered D1 → R2 dump. There is no scheduled cron — Steve runs it manually (or wires a cron trigger from a laptop / CI job). Endpoint: `POST /api/admin/backup`, ADMIN-only.

### One-time setup

```sh
# 1. Create the R2 bucket (only needs to happen once per environment).
wrangler r2 bucket create hughesys-que-backups

# 2. In wrangler.toml, uncomment the [[r2_buckets]] block (binding = "BACKUPS").
# 3. Redeploy: git push origin master.
```

Until the bucket exists and the binding is uncommented the endpoint returns a 503 with a helpful message — it does not 500.

### Trigger a backup

```sh
# Use an admin Bearer token (admin session token from the dashboard, or the
# ADMIN_API_KEY env var if you've set one for server-to-server scripts).
curl -X POST https://hugheseysque.au/api/admin/backup \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Response shape:

```json
{
  "success": true,
  "key": "backup-2026-04-26-03-15-04.json",
  "sizeBytes": 184213,
  "tableCounts": { "orders": 142, "customers": 38, "...": 0 }
}
```

The dump is a single JSON object: `{ exported_at, version: 1, tables: { orders: [...], customers: [...], ... } }` covering `orders`, `customers`, `magic_links`, `settings`, `calendar_events`, `gallery_posts`, `menu_items`, `social_posts`, `users`, `live_chat`, `chat_bans`, `cook_days`.

### Restore

There is no automated restore — the volume is small enough to do by hand and the rare case where you'd reach for a backup (e.g. an admin nuked a row) is more surgical than a full reload anyway.

```sh
# 1. Download the desired backup file from the R2 dashboard (Cloudflare → R2
#    → hughesys-que-backups), or via the CLI:
wrangler r2 object get hughesys-que-backups/backup-2026-04-26-03-15-04.json \
  --file=./restore.json

# 2. Eyeball the JSON. Locate the tables/rows you want to restore.
# 3. Reconstruct rows by running INSERT statements against D1, e.g.:
wrangler d1 execute hughesys-que-db --command="INSERT INTO orders (id, customer_name, ...) VALUES ('ord_123', 'Smith', ...)"
```

For a full table reload, write a tiny script that walks the JSON and emits one INSERT per row — but in practice you almost always want to splice a handful of rows back, not nuke and reload.

## Audit & remediation

`PRODUCTION-AUDIT-2026-04-25.md` in this repo holds the multi-agent production-readiness review and remediation plan. STOP THE BLEED items shipped 2026-04-25; THIS WEEK items in progress 2026-04-26.

## Owner

Steve / Penny Wise I.T. — internal client work.
