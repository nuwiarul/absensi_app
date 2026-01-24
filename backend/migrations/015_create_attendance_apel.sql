-- Apel (laporan) - tidak mempengaruhi tukin.
-- Unik per (user_id, work_date, kind) agar tidak dobel.

CREATE TABLE IF NOT EXISTS attendance_apel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  satker_id UUID NOT NULL REFERENCES satkers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- tanggal kerja lokal (mengikuti timezone setting aplikasi)
  work_date DATE NOT NULL,

  -- waktu kejadian sebenarnya (UTC)
  occurred_at TIMESTAMPTZ NOT NULL,

  -- jenis apel, saat ini dipakai 'PAGI' (bisa diperluas)
  kind TEXT NOT NULL,

  -- dicatat saat event apa (CHECKIN / CHECKOUT)
  source_event TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_apel_user_workdate_kind
  ON attendance_apel(user_id, work_date, kind);

CREATE INDEX IF NOT EXISTS ix_attendance_apel_satker_workdate
  ON attendance_apel(satker_id, work_date);
