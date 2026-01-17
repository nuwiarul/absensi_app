CREATE TABLE user_devices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        device_model TEXT,
        android_version TEXT,
        app_build TEXT,
        client_version TEXT
);

-- ✅ device_id hanya boleh 1 di seluruh tabel
CREATE UNIQUE INDEX ux_user_devices_device_id ON user_devices (device_id);