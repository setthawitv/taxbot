-- Run in Supabase Dashboard → SQL Editor
-- Adds external_transaction_id to detect duplicate slip uploads

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- Unique per user: same bank tx reference can't be saved twice
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_ext_tx_unique
  ON transactions(user_id, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
