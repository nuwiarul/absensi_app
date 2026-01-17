ALTER TABLE attendance_events
    ADD COLUMN IF NOT EXISTS device_model TEXT,
    ADD COLUMN IF NOT EXISTS android_version TEXT,
    ADD COLUMN IF NOT EXISTS app_build TEXT;