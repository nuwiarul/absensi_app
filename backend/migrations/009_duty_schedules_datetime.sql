-- Upgrade duty_schedules to support datetime range (start_at/end_at) and soft-delete.
-- This keeps old columns (schedule_date, start_time, end_time) for backward compatibility.

ALTER TABLE duty_schedules
    ADD COLUMN IF NOT EXISTS start_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_at     TIMESTAMPTZ ,
    ADD COLUMN IF NOT EXISTS title      TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Allow multiple duty schedules per user per day (we will prevent overlap in application logic)
ALTER TABLE duty_schedules DROP CONSTRAINT IF EXISTS uq_user_schedule;

-- Backfill start_at/end_at from existing schedule_date/start_time/end_time.
-- If end_time < start_time, treat it as overnight shift ending next day.
/*UPDATE duty_schedules
SET
    start_at = COALESCE(
        start_at,
        (schedule_date::timestamptz + COALESCE(start_time, TIME '00:00')::time)
    ),
    end_at = COALESCE(
        end_at,
        CASE
            WHEN end_time IS NULL THEN (schedule_date::timestamptz + COALESCE(start_time, TIME '00:00')::time)
            WHEN start_time IS NULL THEN (schedule_date::timestamptz + end_time::time)
            WHEN end_time >= start_time THEN (schedule_date::timestamptz + end_time::time)
            ELSE (schedule_date::timestamptz + end_time::time + INTERVAL '1 day')
        END
    ),
    updated_at = COALESCE(updated_at, created_at);
*/
-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_duty_schedules_satker_start_at ON duty_schedules (satker_id, start_at);
CREATE INDEX IF NOT EXISTS idx_duty_schedules_user_start_at   ON duty_schedules (user_id, start_at);
