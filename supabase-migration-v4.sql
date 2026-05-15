-- Run in Supabase Dashboard → SQL Editor
-- Stores pending receipts awaiting user confirmation

CREATE TABLE IF NOT EXISTS pending_receipts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  receipt_data  JSONB       NOT NULL,
  image_base64  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes'
);

-- Auto-clean expired pending receipts (optional, run as a scheduled job)
-- DELETE FROM pending_receipts WHERE expires_at < NOW();
