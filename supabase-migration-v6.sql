-- Run in Supabase Dashboard → SQL Editor
-- Stores Google refresh token so we can auto-renew expired access tokens

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
