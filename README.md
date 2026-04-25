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

## Audit & remediation

`PRODUCTION-AUDIT-2026-04-25.md` in this repo holds the multi-agent production-readiness review and remediation plan. STOP THE BLEED items shipped 2026-04-25; THIS WEEK items in progress 2026-04-26.

## Owner

Steve / Penny Wise I.T. — internal client work.
