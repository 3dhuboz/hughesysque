# Hughesys Que — Production Readiness Audit

**Date:** 2026-04-25
**Audit team:** 5 specialist agents (Security, Frontend Quality, Backend & Data, Payments & Business Logic, DevOps & Reliability) + Tech Lead synthesis
**Repo:** `C:\Users\Steve\Desktop\GitHub\hughesysque`
**Live URL:** https://hugheseysque.au
**Stack:** React 19/Vite SPA · Cloudflare Pages · Pages Functions (TS) · D1 · Resend · ClickSend · Square

---

## Executive Summary

The site is taking real catering orders, but the storefront "Pay Deposit" button collects card details and charges nothing — Macca has been losing every storefront-paid deposit while customers see a "payment authorised" success page. That single bug dwarfs everything else. Surrounding it are three unauthenticated endpoints (SMS blast, direct payment, seed) and a hardcoded `dev/123` admin backdoor that must close today. Most other findings are either quick wins (delete the 3.4 MB logo, delete the self-unregistering SW, delete misleading docs) or architectural items that can wait once the bleeding stops.

---

## The One Thing

**Kill the fake storefront payment flow today.** Either rip out `handleGenericPayment` and route all deposits through the admin-sent Square invoice link (15 min, copy change + remove the form), or wire Square Web Payments SDK properly (half day). Until this is fixed, every storefront deposit is uncollected revenue and every "deposit authorised" success page is a customer-trust grenade.

---

## STOP THE BLEED (today)

| # | Title | Severity | Effort | Files | Action |
|---|---|---|---|---|---|
| 1 | Fake storefront payment | Critical | 15 min (rip) / half day (real) | `client/src/pages/StorefrontOrder.js:347-371` | Remove `handleGenericPayment` form, fall back to admin-sends-invoice-link flow, fix success-page wording. |
| 2 | Hardcoded `dev/123` admin backdoor | Critical | 5 min | `functions/api/v1/auth/admin-login.ts:30-33` | Delete the block, redeploy. |
| 3 | Unauthenticated SMS blast | Critical | 10 min | `functions/api/v1/sms/blast.ts` | Add `requireAuth(..., 'ADMIN')`. |
| 4 | Unauthenticated direct-payment endpoint | Critical | 10 min | `functions/api/v1/payment/square-pay.ts` | Add admin auth; if unused after #1, delete the file. |
| 5 | Open seed endpoint | Critical | 5 min | `functions/api/v1/seed.ts:13-16` | Always require ADMIN; remove the "if users empty" bypass. |
| 6 | Email/SMS blast secret optional | Critical | 10 min | `email/blast.ts`, `email/order-notification.ts`, `email/test.ts`, `sms/test.ts` | Make secret check unconditional or require ADMIN. |
| 7 | Square webhook accepts unsigned POSTs when key unset | Critical | 5 min | `functions/api/v1/payment/square-webhook.ts:30-41` | Throw 500 if HMAC key absent; never silently allow. |

**Total: ~1 hour of work, all small edits.**

---

## THIS WEEK

| # | Title | Sev | Effort | Files | Action |
|---|---|---|---|---|---|
| 8 | Delete the 3.4 MB logo | High | 30 min | `client/public/logo.png` + 6 references | Replace with optimised SVG or ≤30 KB WebP — biggest single perf win. |
| 9 | Delete the self-unregistering SW | High | 10 min | `client/public/sw.js`, `manifest`, boot nuke code | Remove all PWA scaffolding; not used, costs every former visitor an extra reload. |
| 10 | Delete misleading docs | High | 20 min | `README.md`, `DEPLOY-SITEGROUND.md`, `PRODUCTION-CHECKLIST.md`, `INFRASTRUCTURE.md` | Replace with a 30-line README describing the real CF Pages/D1 stack. |
| 11 | Add `customers` and `magic_links` to schema | High | 30 min | `schema.sql`, new `migrations/` dir | A fresh D1 deploy currently breaks; add tables + indexes; switch to `wrangler d1 migrations`. |
| 12 | Loyalty spend abuse + double-credit | High | 1 hr | `functions/api/v1/orders/index.ts:35-52`, `square-webhook.ts` | Move credit into webhook on `payment.completed`; require auth match; filter to paid catering subtotal. |
| 13 | Square webhook ignores `Pending` orders | High | 30 min | `square-webhook.ts:69-77` | Allow `Pending → Paid` transition; track `balanceCheckoutId`. |
| 14 | Magic-link mailbomb + reset-code brute force | High | 45 min | `customer-magic-link-request.ts:41-48`, `admin-reset-confirm.ts`, `admin-reset-request.ts` | Track `issued_at` directly; 8-char alphanumeric reset codes; daily cap; CF rate-limit rule. |
| 15 | Settings PUT whitelist | High | 20 min | `functions/api/v1/settings/index.ts:36-67` | Allow-list keys; explicitly reject `adminSessionSecret`/`adminPasswordRecord`. |
| 16 | CI typecheck gate | High | 5 min | `.github/workflows/deploy.yml` | Add `npm run typecheck` before deploy step. |
| 17 | Health endpoint + UptimeRobot | High | 20 min | new `functions/api/health.ts` | 20 lines + free monitor; you'll know about outages from a phone push, not from Macca. |

---

## THIS MONTH

| # | Title | Sev | Effort | Action |
|---|---|---|---|---|
| 18 | Approval/capture flow is Stripe-shaped, app is Square | High | half day | Replace `pi_*` checks and `/api/payment/void` with Square-aware capture/refund using `squareCheckoutId`. |
| 19 | Order POST validation | High | 1 hr | Hand-rolled validators; reject negative totals; decide whether anonymous POST stays. |
| 20 | GST/discount math drift | High | 1 hr | Single source of truth for tax/discount/deposit; integer cents end-to-end. |
| 21 | Refund / cancellation path | High | 2 hr | At minimum a "Refund via Square dashboard, mark Cancelled" admin action with audit row. |
| 22 | Order GET access-control split | Medium | 1 hr | Admin-only GET; add `/orders/mine` for magic-link sessions. |
| 23 | Stream chat impersonation | Medium | 20 min | Derive `userName` from session, ignore client value. |
| 24 | External API timeouts | Medium | 30 min | AbortController + single 5xx retry on Resend/ClickSend/Square. |
| 25 | D1 weekly backup to R2 | Medium | 1 hr | Single small Worker; tiny insurance against losing every order. |
| 26 | SEO + BrowserRouter + OG/JSON-LD | Medium | 2 hr | Switch off HashRouter; add OG, canonical, LocalBusiness JSON-LD. |
| 27 | Extract YJRL/Wirez/Penny Wise out of repo | Medium | half day | Move to their own repos; stops cross-client bundle leakage flagged by 3 audits. |
| 28 | Magic-link cleanup + indexes | Medium | 30 min | Daily delete of expired links; indexes on `orders.customer_email`, `cook_day`, `status`. |
| 29 | Hero/ticker images: lazy + dims + alt | Medium | 30 min | Removes CLS, helps a11y and SEO. |
| 30 | Drop one toast system | Low | 15 min | Pick `react-hot-toast`, delete the hand-rolled one (or vice versa). |
| 31 | Stray config files cleanup | Low | 10 min | Delete `netlify/`, `vercel.json`, `railway.json`, `nixpacks.toml`, `.env.example`, `app.js`. |

---

## BACKLOG

- Status-machine guards on order transitions (Medium, ~1 hr)
- Order-edit audit trail (Medium, half day)
- Custom-item price guards (Medium, 15 min)
- Pre-registration order backfill on customer signup (Medium, 1 hr)
- `parseLocalDate` cook-day cutoff TEXT-vs-ms fix (Medium, 30 min)
- Customer/admin tokens move from `localStorage` to httpOnly cookies (Low, half day; only if XSS surface grows)
- HTML-escape customer name/address in admin emails (Low, 15 min)
- ErrorBoundary deploy-key DOM scrape replaced with build-time constant (Low, 15 min)
- Stale `claude/*` and `deploy` remote branches pruned (Low, 5 min)
- Settings-vs-env source logging (Low, 10 min)
- Pickup-time-slots-in-the-past guard (Low, 15 min)

---

## Known & Accepted (deferring on purpose)

- **CSP / X-Content-Type-Options / Referrer-Policy headers** — solo shop, low XSS surface, no third-party script soup. Not worth the iteration cost yet.
- **Sentry / structured logging across all 43 `console.error` sites** — CF Workers Logs is enough once enabled; full Sentry is overkill at current order volume.
- **Full `wrangler d1 migrations` retrofit of historical schema** — adopt going forward; don't backfill the past.
- **Modal focus-traps, ARIA, label associations, skeleton states** — real but not revenue-blocking; address when the design is next touched.
- **Replacing `Math.random()` Square idempotency key with crypto UUID** — collision risk is mathematically negligible at current volume; fix when the payment flow is rebuilt anyway.
- **Mixed time-column types in D1** — annoying, not breaking; clean up next migration.
- **Floating-point dollars** — fold into the GST/discount rebuild (item 20), don't do separately.

---

## Convergence (where multiple audits agreed)

- **Loyalty over-counting** — Backend (Critical) + Payments (Critical). Same root cause: credit happens on order creation regardless of payment status, keyed by raw email. One fix lives in the Square webhook.
- **Order GET access-control split** — Security (Medium) + Backend (High). Customer branch is structurally unreachable. One fix: admin-only + `/orders/mine`.
- **YJRL / Wirez / Penny Wise co-location** — Security + Frontend + DevOps. Three audits, one extraction.
- **Service worker mismatch** — Frontend + DevOps. Both said the same thing; both were right.
- **Square webhook unverified when key unset** — Security + Backend. One fix: make HMAC mandatory.
- **Magic-link throttle broken** — Security + Backend. Same fix.

---

## Contradictions Resolved

- **"Implement a real SW" vs "delete the SW"** — **Verdict: delete.** This site is not a PWA, has no offline use case, and the current SW actively hurts repeat visitors. Real SWs are a six-month commitment to cache invalidation pain; not justified for a BBQ catering site.
- **"Add Zod" (Backend) vs solo-shop pragmatism** — **Verdict: hand-rolled validators.** Zod is fine but an extra dep and a learning curve for one endpoint family; eight lines of `if (typeof x !== 'number' || x < 0)` is the right size.
- **Audit severities vs real-world impact** — Security flagged `localStorage` token storage as Low and the `dev/123` backdoor as Critical, both correct. But Backend's Critical "schema.sql missing tables" only matters on a fresh deploy, while Payments' Critical "fake payment flow" is bleeding money right now. Re-prioritised accordingly: Payments #1 first, schema this week.

---

*Audit conducted 2026-04-25 by a multi-agent expert team coordinated by the Tech Lead. Steve / Penny Wise I.T. / Claude.*
