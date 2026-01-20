-- 012_announcements.sql
-- Feature: Announcements / Pengumuman
-- Scope:
--  - GLOBAL: visible to all users
--  - SATKER: visible only to users in a specific satker

CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope text NOT NULL CHECK (scope IN ('GLOBAL','SATKER')),
    satker_id uuid NULL REFERENCES satkers(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT announcements_scope_satker_check CHECK (
        (scope = 'GLOBAL' AND satker_id IS NULL) OR
        (scope = 'SATKER' AND satker_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_announcements_active_created_at
    ON announcements (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_scope_satker
    ON announcements (scope, satker_id);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();
