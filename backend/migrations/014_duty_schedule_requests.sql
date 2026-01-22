-- Pending duty schedules requested by MEMBER users.

CREATE TABLE IF NOT EXISTS duty_schedule_requests
(
    id            UUID PRIMARY KEY       DEFAULT gen_random_uuid(),

    satker_id     UUID          NOT NULL REFERENCES satkers (id),
    user_id       UUID          NOT NULL REFERENCES users (id),

    start_at      TIMESTAMPTZ   NOT NULL,
    end_at        TIMESTAMPTZ   NOT NULL,

    schedule_type schedule_type NOT NULL,
    title         TEXT,
    note          TEXT,

    status        TEXT          NOT NULL DEFAULT 'SUBMITTED',
    reject_reason TEXT,
    decided_by    UUID,
    decided_at    TIMESTAMPTZ,

    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT duty_schedule_requests_status_check
        CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELED')),

    CONSTRAINT duty_schedule_requests_time_check
        CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_dsr_satker_status ON duty_schedule_requests (satker_id, status);
CREATE INDEX IF NOT EXISTS idx_dsr_user_status ON duty_schedule_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_dsr_time ON duty_schedule_requests (start_at, end_at);
