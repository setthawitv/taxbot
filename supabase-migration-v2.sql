-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Adds new user profile fields for the 3-step onboarding

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name     TEXT,
  ADD COLUMN IF NOT EXISTS last_name      TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS business_type  TEXT CHECK (business_type IN ('individual', 'partnership', 'company')),
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN DEFAULT FALSE;
