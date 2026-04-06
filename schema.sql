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
  square_checkout_id TEXT
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
