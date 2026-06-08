-- Migration v7: Import logs table
CREATE TABLE IF NOT EXISTS import_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  filename    TEXT NOT NULL,
  order_count INT  DEFAULT 0,
  new_count   INT  DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_user ON import_logs(user_id, created_at DESC);
