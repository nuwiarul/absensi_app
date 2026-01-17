DO $$ BEGIN
    CREATE TYPE attendance_leave_type AS ENUM (
        'NORMAL',
        'DINAS_LUAR',
        'WFA',
        'WFH',
        'IJIN',
        'SAKIT'
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE attendance_events
    ADD COLUMN IF NOT EXISTS attendance_leave_type attendance_leave_type NOT NULL DEFAULT 'NORMAL';

ALTER TABLE attendance_events
    ADD COLUMN IF NOT EXISTS attendance_leave_notes TEXT NULL;
