# D1 migrations

Incremental schema changes go here. Baseline schema for a fresh deploy is in
`../schema.sql`.

## Convention

Files are named `NNNN_short_description.sql` where `NNNN` is a zero-padded
sequence (`0001`, `0002`, …) — wrangler runs them in lexical order. Each file
should be:

- **Idempotent** — wrap CREATE TABLE / CREATE INDEX in `IF NOT EXISTS`
- **Forward-only** — no DROP unless the column is genuinely dead and there's
  a backup; D1 has no rollback
- **Self-contained** — one logical change per file

## Apply

```sh
# Locally (dev D1):
wrangler d1 migrations apply hughesys-que-db --local

# Production (live D1 — be sure):
wrangler d1 migrations apply hughesys-que-db --remote
```

`migrations_dir = "migrations"` is set in `wrangler.toml` so wrangler picks
this folder up automatically.

## Existing tables not tracked here

`customers` and `magic_links` were created ad-hoc in production on 2026-04-21
without a migration file. They're now in `schema.sql` for fresh deploys and
should not be re-created here. If you ever drop the live D1 and rebuild,
re-run `schema.sql` first; this folder picks up from there.

## Audit reference

2026-04-25 production audit, Backend Critical #1 — schema/migrations gap.
