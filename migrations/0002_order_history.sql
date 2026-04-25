-- 0002_order_history.sql
--
-- Order edit-history audit trail. Records one row per field per admin PUT
-- to /api/v1/orders/:id so we can answer "who changed what, when".
--
-- field         — camelCase API field name (status, trackingNumber, etc.).
--                 Matches what the admin UI displays; no snake_case decode
--                 needed in the viewer.
-- actor_email   — auth.email of the staff member who made the edit.
-- old_value /
-- new_value     — stringified values. Objects are JSON.stringify'd; primitives
--                 become strings (so booleans surface as "true"/"false",
--                 numbers as their decimal repr).
-- changed_at    — INTEGER Unix ms (Date.now()), matches the convention used
--                 by the customers/magic_links tables.
--
-- Idempotent (IF NOT EXISTS) so a fresh deploy from schema.sql followed by
-- migration apply is a no-op rather than a hard failure.
--
-- Audit reference: PRODUCTION-AUDIT-2026-04-25.md BACKLOG — order-edit
-- audit trail.

CREATE TABLE IF NOT EXISTS order_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  actor_email TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, changed_at DESC);
