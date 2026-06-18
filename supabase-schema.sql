-- ════════════════════════════════════════════════════════════════════════════
-- Vendee — Consolidated Database Schema (single source of truth)
-- ════════════════════════════════════════════════════════════════════════════
-- Mirrors the live database AFTER the cleanup migrations
-- (cleanup_unused_tables_and_columns + enable_rls_all_tables).
-- Generated from the real schema via the Supabase MCP, so types/defaults/checks
-- below match production exactly.
--
-- Supersedes: supabase-setup.sql, supabase-migration-v2..v7.sql,
--             supabase/stock_tables.sql (kept only for history).
--
-- Safe to run on a fresh/empty project (everything is IF NOT EXISTS).
-- All app access is server-side via the service-role key, so RLS is enabled
-- with NO policies (service role bypasses RLS; the public anon key is blocked).
-- ════════════════════════════════════════════════════════════════════════════

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id         TEXT UNIQUE NOT NULL,
  display_name         TEXT,
  picture_url          TEXT,
  first_name           TEXT,
  last_name            TEXT,
  phone                TEXT,
  business_name        TEXT,
  business_type        TEXT CHECK (business_type IN ('individual', 'partnership', 'company')),
  vat_registered       BOOLEAN DEFAULT FALSE,
  -- Google integration
  google_email         TEXT,
  google_access_token  TEXT,
  google_refresh_token TEXT,
  sheet_id             TEXT,
  drive_folder_id      TEXT,
  -- Subscription
  plan                 TEXT NOT NULL DEFAULT 'trial',   -- trial | free | eco | pro | platinum
  plan_expires_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT CHECK (type IN ('income', 'expense')),
  amount           NUMERIC(12, 2),
  vendor           TEXT,
  description      TEXT,
  source           TEXT DEFAULT 'manual',           -- manual | slip_photo | platform | ...
  -- Tax fields
  vat_amount       NUMERIC(12, 2) DEFAULT 0,
  withholding_tax  NUMERIC(12, 2) DEFAULT 0,
  invoice_no       TEXT,
  tax_id           TEXT,
  -- Staff attribution (who entered it via a staff invite link)
  staff_code       TEXT,
  staff_name       TEXT,
  transaction_date DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── vendor_rules ─────────────────────────────────────────────────────────────
-- Remembers whether a given vendor name means income or expense.
CREATE TABLE IF NOT EXISTS vendor_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, vendor_name)
);

-- ── platform_orders ──────────────────────────────────────────────────────────
-- Rows imported from TikTok/Shopee/Lazada Excel exports.
CREATE TABLE IF NOT EXISTS platform_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopee', 'lazada')),
  order_id        TEXT NOT NULL,
  sku_line_id     TEXT,
  line_key        TEXT NOT NULL,                   -- dedup key, unique per user
  product_name    TEXT,
  variant         TEXT,
  seller_sku      TEXT,
  amount          NUMERIC(12, 2) NOT NULL,
  order_date      DATE NOT NULL,
  import_batch_id TEXT,
  imported_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, line_key)
);
CREATE INDEX IF NOT EXISTS idx_platform_orders_user_date ON platform_orders(user_id, order_date);

-- ── import_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  filename     TEXT NOT NULL,
  order_count  INT DEFAULT 0,
  new_count    INT DEFAULT 0,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_logs_user ON import_logs(user_id, created_at DESC);

-- ── landing_leads ────────────────────────────────────────────────────────────
-- Segment data from anonymous visitors who use the public tax calculator
-- (gated: they fill this before the result is revealed). No user_id — anonymous.
CREATE TABLE IF NOT EXISTS landing_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_range     TEXT,
  occupation    TEXT,
  sales_channel TEXT,
  income_range  TEXT,
  taxpayer_type TEXT,                              -- individual | corporate
  est_income    NUMERIC(14, 2),
  est_tax       NUMERIC(14, 2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_landing_leads_created ON landing_leads(created_at DESC);

-- ── chat_messages ────────────────────────────────────────────────────────────
-- AI chatbot history (Pro: descriptive / Platinum: predictive). Doubles as the
-- monthly message-quota source (count of role='user' rows in the current month).
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  model      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

-- ── payments ─────────────────────────────────────────────────────────────────
-- Beam payment-gateway charges. (line_user_id matches users.line_user_id, TEXT.)
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  charge_id    TEXT UNIQUE,                        -- Beam charge id (webhook lookup key)
  plan         TEXT,                               -- eco | pro | platinum
  amount_thb   NUMERIC(12, 2),
  status       TEXT DEFAULT 'pending',             -- pending | completed | failed
  reference_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_line_user ON payments(line_user_id);

-- ── account_admins ───────────────────────────────────────────────────────────
-- Extra admins (by Google email) who can manage an owner's account.
CREATE TABLE IF NOT EXISTS account_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_email   TEXT NOT NULL,
  admin_name    TEXT,
  invite_code   TEXT UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8),
  status        TEXT DEFAULT 'pending',            -- pending | accepted
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── staff_invites ────────────────────────────────────────────────────────────
-- Invite codes that let staff submit expenses without LINE auth.
CREATE TABLE IF NOT EXISTS staff_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code          TEXT UNIQUE NOT NULL,
  label         TEXT DEFAULT 'Staff',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  sku           TEXT,
  parent_sku    TEXT,
  name          TEXT NOT NULL,
  category      TEXT,
  unit          TEXT DEFAULT 'ชิ้น',
  cost_price    NUMERIC(12, 2) DEFAULT 0,
  sell_price    NUMERIC(12, 2) DEFAULT 0,
  stock_qty     INTEGER DEFAULT 0,
  low_stock_at  INTEGER DEFAULT 5,
  barcode       TEXT,
  attr1_type    TEXT,
  attr1_val     TEXT,
  attr2_type    TEXT,
  attr2_val     TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku  ON products(user_id, sku);

-- ── product_platform_names ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_platform_names (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform, platform_name)
);
CREATE INDEX IF NOT EXISTS idx_ppn_user_platform ON product_platform_names(user_id, platform);

-- ── stock_movements ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
  qty         INTEGER NOT NULL,
  stock_after INTEGER,
  ref_type    TEXT,
  ref_id      TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_created ON stock_movements(user_id, created_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- No policies: the app only touches these tables with the service-role key,
-- which bypasses RLS. Enabling RLS blocks the public anon key from direct access.
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_platform_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements        ENABLE ROW LEVEL SECURITY;
