-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Adds drive_folder_id column to store the user's TaxBot root folder in Google Drive

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
