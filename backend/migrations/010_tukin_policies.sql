-- 010_tukin_policies.sql

-- Tukin policies (rule-based)
CREATE TABLE IF NOT EXISTS tukin_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope text NOT NULL CHECK (scope IN ('GLOBAL', 'SATKER')),
  satker_id uuid NULL REFERENCES satkers(id) ON DELETE CASCADE,

  effective_from date NOT NULL,
  effective_to date NULL,

  -- Penalty/weights
  missing_checkout_penalty_pct DOUBLE PRECISION NOT NULL DEFAULT 25.0,
  late_tolerance_minutes int NOT NULL DEFAULT 0,
  late_penalty_per_minute_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  max_daily_penalty_pct DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  out_of_geofence_penalty_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tukin_policy_scope_satker_ck CHECK (
    (scope = 'GLOBAL' AND satker_id IS NULL) OR
    (scope = 'SATKER' AND satker_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS tukin_policies_scope_satker_from_uidx
  ON tukin_policies (scope, satker_id, effective_from);

CREATE TABLE IF NOT EXISTS tukin_leave_type_rules (
  policy_id uuid NOT NULL REFERENCES tukin_policies(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  credit DOUBLE PRECISION NOT NULL CHECK (credit >= 0 AND credit <= 1),
  counts_as_present boolean NOT NULL DEFAULT true,
  PRIMARY KEY (policy_id, leave_type)
);

-- Seed a GLOBAL policy if none exists
INSERT INTO tukin_policies (scope, satker_id, effective_from)
SELECT 'GLOBAL', NULL, DATE '2000-01-01'
WHERE NOT EXISTS (
  SELECT 1 FROM tukin_policies WHERE scope = 'GLOBAL'
);

-- Seed default leave credits for GLOBAL policy
WITH p AS (
  SELECT id FROM tukin_policies WHERE scope='GLOBAL' ORDER BY effective_from ASC LIMIT 1
)
INSERT INTO tukin_leave_type_rules (policy_id, leave_type, credit, counts_as_present)
SELECT p.id, x.leave_type, x.credit, true
FROM p
JOIN (VALUES
  ('CUTI'::leave_type, 1.0::DOUBLE PRECISION),
  ('SAKIT'::leave_type, 1.0::DOUBLE PRECISION),
  ('IJIN'::leave_type, 0.8::DOUBLE PRECISION),
  ('DINAS_LUAR'::leave_type, 1.0::DOUBLE PRECISION)
) AS x(leave_type, credit) ON true
ON CONFLICT (policy_id, leave_type) DO NOTHING;
