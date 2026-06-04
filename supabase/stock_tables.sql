-- ═══════════════════════════════════════════════════
-- Stock Management Tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Products
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  sku           TEXT,
  parent_sku    TEXT,                          -- for variants
  name          TEXT NOT NULL,
  category      TEXT,
  unit          TEXT DEFAULT 'ชิ้น',
  cost_price    NUMERIC(12,2) DEFAULT 0,
  sell_price    NUMERIC(12,2) DEFAULT 0,
  stock_qty     INTEGER DEFAULT 0,
  low_stock_at  INTEGER DEFAULT 5,
  barcode       TEXT,
  attr1_type    TEXT,                          -- e.g. "Size"
  attr1_val     TEXT,                          -- e.g. "M"
  attr2_type    TEXT,                          -- e.g. "Color"
  attr2_val     TEXT,                          -- e.g. "ดำ"
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Platform name → product mapping
CREATE TABLE IF NOT EXISTS product_platform_names (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,                 -- 'shopee','tiktok','lazada'
  platform_name TEXT NOT NULL,                 -- exact name on platform Excel
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_name)
);

-- 3. Stock movement history
CREATE TABLE IF NOT EXISTS stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('in','out','adjust')),
  qty           INTEGER NOT NULL,              -- positive=in, negative=out
  stock_after   INTEGER,                       -- stock level after movement
  ref_type      TEXT,                          -- 'import_excel','purchase','manual','adjust'
  ref_id        TEXT,                          -- batch_id or transaction_id
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user      ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_ppn_user_platform  ON product_platform_names(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product  ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_created  ON stock_movements(user_id, created_at DESC);
