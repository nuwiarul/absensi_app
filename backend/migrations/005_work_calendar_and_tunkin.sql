-- 005_work_calendar_and_tunkin.sql

-- ===== Enums =====
DO
$$
    BEGIN
        CREATE TYPE holiday_scope AS ENUM ('NATIONAL', 'SATKER');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE holiday_kind AS ENUM ('HOLIDAY', 'HALF_DAY');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

DO
$$
    BEGIN
        CREATE TYPE calendar_day_type AS ENUM ('WORKDAY', 'HOLIDAY', 'HALF_DAY');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;

-- ===== Satker weekly work pattern =====
CREATE TABLE IF NOT EXISTS satker_work_patterns
(
    id             UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    satker_id      UUID        NOT NULL REFERENCES satkers (id) ON DELETE CASCADE,
    effective_from DATE        NOT NULL,

    mon_work       BOOLEAN     NOT NULL DEFAULT TRUE,
    tue_work       BOOLEAN     NOT NULL DEFAULT TRUE,
    wed_work       BOOLEAN     NOT NULL DEFAULT TRUE,
    thu_work       BOOLEAN     NOT NULL DEFAULT TRUE,
    fri_work       BOOLEAN     NOT NULL DEFAULT TRUE,
    sat_work       BOOLEAN     NOT NULL DEFAULT FALSE,
    sun_work       BOOLEAN     NOT NULL DEFAULT FALSE,

    work_start     TIME        NOT NULL DEFAULT '07:30',
    work_end       TIME        NOT NULL DEFAULT '16:00',

    -- optional: khusus half-day (kalau satker punya setengah hari)
    half_day_end   TIME        NULL,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_satker_effective UNIQUE (satker_id, effective_from)
);

-- default pattern untuk satker existing (Mon-Fri kerja)
/*INSERT INTO satker_work_patterns (satker_id, effective_from)
SELECT id, CURRENT_DATE
FROM satkers
ON CONFLICT DO NOTHING;*/

-- ===== Holidays =====
CREATE TABLE IF NOT EXISTS holidays
(
    id           UUID PRIMARY KEY       DEFAULT uuid_generate_v4(),
    scope        holiday_scope NOT NULL,
    satker_id    UUID          NULL REFERENCES satkers (id) ON DELETE CASCADE,

    holiday_date DATE          NOT NULL,
    kind         holiday_kind  NOT NULL DEFAULT 'HOLIDAY',
    name         TEXT          NOT NULL,
    half_day_end TIME          NULL,

    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_holiday_scope CHECK (
        (scope = 'NATIONAL' AND satker_id IS NULL) OR
        (scope = 'SATKER' AND satker_id IS NOT NULL)
        ),
    CONSTRAINT uq_holiday UNIQUE (scope, satker_id, holiday_date)
);

-- ===== Materialized calendar per satker per day =====
CREATE TABLE IF NOT EXISTS satker_calendar_days
(
    satker_id      UUID              NOT NULL REFERENCES satkers (id) ON DELETE CASCADE,
    work_date      DATE              NOT NULL,

    day_type       calendar_day_type NOT NULL,
    expected_start TIME              NULL,
    expected_end   TIME              NULL,
    note           TEXT              NULL,

    created_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),

    PRIMARY KEY (satker_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_cal_satker_date ON satker_calendar_days (satker_id, work_date);

-- updated_at trigger (reuse set_updated_at function existing)
DROP TRIGGER IF EXISTS trg_cal_updated ON satker_calendar_days;
CREATE TRIGGER trg_cal_updated
    BEFORE UPDATE
    ON satker_calendar_days
    FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ===== Add columns to tunkin results =====
ALTER TABLE performance_allowance_results
    ADD COLUMN IF NOT EXISTS working_days        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approved_leave_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS holiday_work_days   INTEGER NOT NULL DEFAULT 0;
