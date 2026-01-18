-- App settings (global key-value), used for operational settings like timezone.

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL
);

-- Default timezone for Indonesia operations.
INSERT INTO app_settings(key, value)
VALUES ('default_timezone', 'Asia/Jakarta')
ON CONFLICT (key) DO NOTHING;
