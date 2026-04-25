-- 0001_orders_loyalty_balance.sql
--
-- Two new columns on `orders` to support the loyalty-credit move (audit
-- Batch E) and the deposit/balance Square-link split.
--
-- balance_checkout_id   — second Square checkout id for catering balance
--                          payments. Deposit stays in square_checkout_id;
--                          this column lets the webhook accept either id.
-- loyalty_credited      — idempotency flag for catering rewards. Set to 1
--                          when creditLoyaltyIfNeeded runs successfully so
--                          a webhook replay or admin re-Mark-Paid won't
--                          double-credit.
--
-- SQLite has no `ADD COLUMN IF NOT EXISTS`. wrangler tracks applied
-- migrations in d1_migrations so this only runs once. If you're rebuilding
-- from a fresh schema.sql (which already has these columns) the wrangler
-- migration runner will still try to apply this and fail — manually mark
-- this migration applied in that case (see migrations/README.md).

ALTER TABLE orders ADD COLUMN balance_checkout_id TEXT;
ALTER TABLE orders ADD COLUMN loyalty_credited INTEGER NOT NULL DEFAULT 0;
