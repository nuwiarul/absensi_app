-- 011_tukin_calculations.sql

-- Cache hasil perhitungan tukin per bulan agar admin-web cepat.
-- month disimpan sebagai tanggal pertama bulan tsb (YYYY-MM-01)

CREATE TABLE IF NOT EXISTS tukin_calculations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  month date NOT NULL,
  satker_id uuid NOT NULL REFERENCES satkers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES tukin_policies(id) ON DELETE RESTRICT,

  base_tukin bigint NOT NULL DEFAULT 0,
  expected_units double precision NOT NULL DEFAULT 0,
  earned_credit double precision NOT NULL DEFAULT 0,
  attendance_ratio double precision NOT NULL DEFAULT 0,
  final_tukin bigint NOT NULL DEFAULT 0,

  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tukin_calculations_month_user_uidx
  ON tukin_calculations (month, user_id);

CREATE INDEX IF NOT EXISTS tukin_calculations_month_satker_idx
  ON tukin_calculations (month, satker_id);
