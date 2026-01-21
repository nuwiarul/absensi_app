-- Add profile photo key to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_key TEXT;

CREATE INDEX IF NOT EXISTS idx_users_profile_photo_key ON users(profile_photo_key);
