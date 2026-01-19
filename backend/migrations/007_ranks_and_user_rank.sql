-- 007_ranks_and_user_rank.sql

-- Master data: pangkat / golongan
CREATE TABLE IF NOT EXISTS ranks
(
    id          UUID PRIMARY KEY     DEFAULT uuid_generate_v4(),
    code        TEXT UNIQUE NOT NULL, -- contoh: "A1", "III/a", dll
    name        TEXT        NOT NULL, -- contoh: "Penata Muda", dll
    description TEXT,

    -- Optional: nominal dasar tukin untuk pangkat/golongan ini.
    -- Jika nantinya aturan tukin lebih kompleks, kolom ini masih bisa dipakai sebagai default.
    tukin_base  BIGINT      NOT NULL DEFAULT 0 CHECK (tukin_base >= 0),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add rank reference to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS rank_id UUID REFERENCES ranks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_rank_id ON users (rank_id);
