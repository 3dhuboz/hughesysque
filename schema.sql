-- Hughesys Que — Cloudflare D1 Schema
-- Run: wrangler d1 execute hughesys-que-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  is_verified INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  address TEXT,
  dietary_preferences TEXT,
  stamps INTEGER DEFAULT 0,
  has_catering_discount INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  unit TEXT,
  min_quantity INTEGER,
  preparation_options TEXT,
  image TEXT,
  category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  availability_type TEXT DEFAULT 'everyday',
  specific_date TEXT,
  specific_dates TEXT,
  is_pack INTEGER DEFAULT 0,
  pack_groups TEXT,
  available_for_catering INTEGER DEFAULT 0,
  catering_category TEXT,
  moq INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  deposit_amount REAL,
  status TEXT NOT NULL DEFAULT 'Pending',
  cook_day TEXT NOT NULL,
  type TEXT NOT NULL,
  pickup_time TEXT,
  created_at TEXT NOT NULL,
  temperature TEXT,
  fulfillment_method TEXT,
  delivery_address TEXT,
  delivery_fee REAL,
  tracking_number TEXT,
  courier TEXT,
  collection_pin TEXT,
  pickup_location TEXT,
  discount_applied INTEGER DEFAULT 0,
  payment_intent_id TEXT,
  square_checkout_id TEXT,
  -- Square checkout id for the BALANCE-due link on catering orders that paid
  -- a 50% deposit. The deposit link's id stays in square_checkout_id; this
  -- column tracks the second link so the webhook can mark either as paid.
  balance_checkout_id TEXT,
  -- Idempotency flag for loyalty crediting. Flipped to 1 the first time the
  -- order moves to Paid/Completed and creditLoyaltyIfNeeded runs. Prevents
  -- double-credit if status flips to Paid more than once (e.g. webhook
  -- replay or admin re-clicking Mark Paid after a revert).
  loyalty_credited INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  time TEXT,
  start_time TEXT,
  end_time TEXT,
  order_id TEXT,
  image TEXT,
  tags TEXT
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  image TEXT,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  hashtags TEXT,
  published_at TEXT,
  platform_post_id TEXT,
  publish_error TEXT
);

CREATE TABLE IF NOT EXISTS gallery_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL,
  approved INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  liked_by TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cook_days (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  is_open INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS live_chat (
  id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_id TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON live_chat(stream_id, created_at);

CREATE TABLE IF NOT EXISTS chat_bans (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  reason TEXT,
  banned_at TEXT NOT NULL DEFAULT (datetime('now')),
  banned_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_bans_name ON chat_bans(user_name);

-- Customer accounts (added 2026-04-21 as part of the magic-link rewards
-- system, but missing from this schema file until 2026-04-26 — a fresh
-- `wrangler d1 execute --file=schema.sql` deploy was broken until now).
-- Timestamp columns are INTEGER Unix ms (Date.now()) to match the runtime
-- code in functions/api/v1/customers/* and the magic-link auth flow.
CREATE TABLE IF NOT EXISTS customers (
  email TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  catering_spend_cents INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_order_at INTEGER,
  created_at INTEGER NOT NULL,
  email_verified_at INTEGER
);

-- Single-use customer sign-in tokens. 15-minute TTL, marked consumed_at on
-- exchange. Cleanup of expired rows runs on a schedule (TBD).
CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email, expires_at DESC);

-- Order lookup indexes — admin order list filters by status / cook_day, and
-- the /orders/mine endpoint (separate audit item) will filter by email.
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_cook_day ON orders(cook_day);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Order edit-history audit trail. One row per changed field per PUT to
-- /api/v1/orders/:id. `field` is the camelCase API field name (matches
-- what the admin UI displays); `actor_email` is the staff member who
-- made the edit. changed_at is INTEGER Unix ms (Date.now()) for cheap
-- DESC sorts. See PRODUCTION-AUDIT-2026-04-25.md BACKLOG (order-edit
-- audit trail) and migrations/0002_order_history.sql.
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
