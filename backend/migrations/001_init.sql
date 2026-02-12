-- 001_init.sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ===== Enums =====
DO
$$
    BEGIN
        CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'SATKER_ADMIN', 'SATKER_HEAD', 'MEMBER');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE leave_type AS ENUM ('IJIN', 'SAKIT', 'CUTI', 'DINAS_LUAR');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE leave_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE attendance_event_type AS ENUM ('CHECK_IN', 'CHECK_OUT');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE schedule_type AS ENUM ('REGULAR', 'SHIFT', 'ON_CALL', 'SPECIAL');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

-- ===== Tables =====

-- Satker
CREATE TABLE IF NOT EXISTS satkers
(
    id         UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    code       TEXT UNIQUE NOT NULL,
    name       TEXT        NOT NULL,
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (anggota)
CREATE TABLE IF NOT EXISTS users
(
    id                    UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    satker_id             UUID        NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    nrp                   TEXT UNIQUE NOT NULL, -- nomor anggota / NRP
    full_name             TEXT        NOT NULL,
    email                 CITEXT UNIQUE,
    phone                 TEXT,
    role                  user_role   NOT NULL DEFAULT 'MEMBER',
    password_hash         TEXT        NOT NULL, -- untuk login backend (opsional jika SSO)
    is_active             BOOLEAN     NOT NULL DEFAULT TRUE,

    -- untuk biometrik/face profile (jangan simpan foto mentah di DB)
    face_template_version INT         NOT NULL DEFAULT 1,
    face_template_hash    TEXT,                 -- hash/identifier template (embedding disimpan aman di storage khusus jika perlu)

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1 satker punya 1 kepala satker aktif (bisa riwayat)
CREATE TABLE IF NOT EXISTS satker_heads
(
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    satker_id   UUID NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    active_from DATE NOT NULL    DEFAULT CURRENT_DATE,
    active_to   DATE,

    CONSTRAINT uq_satker_head_active UNIQUE (satker_id, active_to),
    CONSTRAINT ck_active_range CHECK (active_to IS NULL OR active_to >= active_from)
);

-- Lokasi absensi (geofence)
CREATE TABLE IF NOT EXISTS geofences
(
    id            UUID PRIMARY KEY          DEFAULT uuid_generate_v4(),
    satker_id     UUID             NOT NULL REFERENCES satkers (id) ON DELETE CASCADE,
    name          TEXT             NOT NULL,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER          NOT NULL CHECK (radius_meters > 0),

    is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Jadwal dinas / shift
CREATE TABLE IF NOT EXISTS duty_schedules
(
    id            UUID PRIMARY KEY       DEFAULT uuid_generate_v4(),
    satker_id     UUID          NOT NULL REFERENCES satkers (id) ON DELETE CASCADE,
    user_id       UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    schedule_date DATE          NOT NULL,
    type          schedule_type NOT NULL DEFAULT 'REGULAR',
    start_time    TIME,
    end_time      TIME,
    notes         TEXT,
    created_by    UUID          REFERENCES users (id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_user_schedule UNIQUE (user_id, schedule_date, type)
);

-- Pengajuan ijin
CREATE TABLE IF NOT EXISTS leave_requests
(
    id            UUID PRIMARY KEY      DEFAULT uuid_generate_v4(),
    satker_id     UUID         NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    tipe          leave_type   NOT NULL,
    start_date    DATE         NOT NULL,
    end_date      DATE         NOT NULL,
    reason        TEXT,
    status        leave_status NOT NULL DEFAULT 'DRAFT',

    submitted_at  TIMESTAMPTZ,
    decided_at    TIMESTAMPTZ,
    approver_id   UUID         REFERENCES users (id) ON DELETE SET NULL, -- kepala satker
    decision_note TEXT,

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT ck_leave_range CHECK (end_date >= start_date)
);

-- Absensi sesi (rekap per hari)
CREATE TABLE IF NOT EXISTS attendance_sessions
(
    id           UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    satker_id    UUID        NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    work_date    DATE        NOT NULL,

    check_in_at  TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    status       TEXT        NOT NULL DEFAULT 'OPEN', -- OPEN/CLOSED/INVALID (bisa enum nanti)

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_attendance_session UNIQUE (user_id, work_date)
);

-- Absensi event mentah (audit)
CREATE TABLE IF NOT EXISTS attendance_events
(
    id                  UUID PRIMARY KEY               DEFAULT uuid_generate_v4(),
    session_id          UUID REFERENCES attendance_sessions (id) ON DELETE CASCADE,
    satker_id           UUID                  NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    user_id             UUID                  NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    event_type          attendance_event_type NOT NULL,
    occurred_at         TIMESTAMPTZ           NOT NULL DEFAULT now(),

    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    accuracy_meters     DOUBLE PRECISION,

    geofence_id         UUID                  REFERENCES geofences (id) ON DELETE SET NULL,
    distance_to_fence_m DOUBLE PRECISION,

    selfie_object_key   TEXT, -- simpan ke object storage (S3/MinIO), DB hanya key
    liveness_score      DOUBLE PRECISION,
    face_match_score    DOUBLE PRECISION,

    device_id           TEXT,
    client_version      TEXT,

    server_challenge_id UUID, -- untuk anti-replay (opsional)
    created_at          TIMESTAMPTZ           NOT NULL DEFAULT now()
);

-- Aturan tunkin (contoh awal)
CREATE TABLE IF NOT EXISTS performance_allowance_rules
(
    id                      UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    satker_id               UUID REFERENCES satkers (id) ON DELETE CASCADE,
    name                    TEXT        NOT NULL,
    base_amount             BIGINT      NOT NULL CHECK (base_amount >= 0),

    -- contoh penalti:
    penalty_absent_per_day  BIGINT      NOT NULL DEFAULT 0,
    penalty_late_per_minute BIGINT      NOT NULL DEFAULT 0,

    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hasil perhitungan tunkin per periode
CREATE TABLE IF NOT EXISTS performance_allowance_results
(
    id             UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    satker_id      UUID        NOT NULL REFERENCES satkers (id) ON DELETE RESTRICT,
    user_id        UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    period_start   DATE        NOT NULL,
    period_end     DATE        NOT NULL,

    present_days   INTEGER     NOT NULL DEFAULT 0,
    absent_days    INTEGER     NOT NULL DEFAULT 0,
    late_minutes   INTEGER     NOT NULL DEFAULT 0,

    gross_amount   BIGINT      NOT NULL DEFAULT 0,
    penalty_amount BIGINT      NOT NULL DEFAULT 0,
    net_amount     BIGINT      NOT NULL DEFAULT 0,

    calculated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_period CHECK (period_end >= period_start),
    CONSTRAINT uq_result UNIQUE (user_id, period_start, period_end)
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_users_satker ON users (satker_id);
CREATE INDEX IF NOT EXISTS idx_geofences_satker ON geofences (satker_id);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_att_sess_user_date ON attendance_sessions (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_att_event_user_time ON attendance_events (user_id, occurred_at);

-- ===== Updated_at auto =====
CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_satkers_updated ON satkers;
CREATE TRIGGER trg_satkers_updated
    BEFORE UPDATE
    ON satkers
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
    BEFORE UPDATE
    ON users
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leave_updated ON leave_requests;
CREATE TRIGGER trg_leave_updated
    BEFORE UPDATE
    ON leave_requests
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_att_sess_updated ON attendance_sessions;
CREATE TRIGGER trg_att_sess_updated
    BEFORE UPDATE
    ON attendance_sessions
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO satkers (id, code, name)
VALUES ('11111111-1111-1111-1111-111111111111', '111111', 'Superuser Satker');


INSERT INTO users (id, satker_id, nrp, full_name, email, role, password_hash, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'superuser', 'Superuser',
        'superuser@resta-pontianak.my.id', 'SUPERADMIN', '$argon2id$v=19$m=4096,t=3,p=1$FUsYOU8WAveGD2K899+Nlw$lkuGOpdcUFgJm85ZO8BPLIMUMrA65KQf3ciGJDTF1VQ', true);
