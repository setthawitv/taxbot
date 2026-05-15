-- Run this in Supabase Dashboard → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT UNIQUE NOT NULL,
  google_access_token TEXT,
  google_email TEXT,
  sheet_id TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2),
  vendor TEXT,
  description TEXT,
  transaction_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
