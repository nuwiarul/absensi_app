-- Manual edit fields for attendance sessions (for admin correction)

ALTER TABLE attendance_sessions
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS manual_note TEXT NULL,
    ADD COLUMN IF NOT EXISTS manual_updated_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS manual_updated_at TIMESTAMPTZ NULL;
