-- ═══════════════════════════════════════════════════════════════
--  SECURE VOTING SYSTEM — Production Database Schema
--  Run once on a fresh database: psql -U postgres -d voting_db -f database.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Admins ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username     TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Elections ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'ended', 'results_published')),
  -- Shamir key shares stored encrypted at rest (base64)
  key_share_1     TEXT,
  key_share_2     TEXT,
  key_share_3     TEXT,
  -- Public key used during active voting
  public_key_pem  TEXT,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES admins(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Candidates ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id   UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  party         TEXT,
  bio           TEXT,
  position      INT NOT NULL DEFAULT 0,   -- display order
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Voters ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Voter eligibility per election ───────────────────────────
CREATE TABLE IF NOT EXISTS voter_eligibility (
  voter_id      UUID NOT NULL REFERENCES voters(id),
  election_id   UUID NOT NULL REFERENCES elections(id),
  has_voted     BOOLEAN NOT NULL DEFAULT false,
  voted_at      TIMESTAMPTZ,
  PRIMARY KEY (voter_id, election_id)
);

-- ─── Encrypted Votes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id     UUID NOT NULL REFERENCES elections(id),
  encrypted_data  TEXT NOT NULL,     -- RSA-OAEP encrypted, base64
  cast_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Deliberately NO voter_id link here — vote is anonymous
);

-- ─── Audit Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID,                  -- voter or admin id (NULL for anon)
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,                  -- table/resource name
  entity_id   UUID,
  ip_address  TEXT,
  user_agent  TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Refresh tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('voter', 'admin')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS election_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  result_status VARCHAR(20) NOT NULL CHECK (result_status IN ('winner', 'loser', 'tie')),
  votes INTEGER NOT NULL DEFAULT 0,
  percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  rank_position INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, candidate_id)
);

-- ─── Indices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_voters_email          ON voters(email);
CREATE INDEX IF NOT EXISTS idx_votes_election        ON votes(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_election   ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_voter     ON voter_eligibility(voter_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_election  ON voter_eligibility(election_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor           ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash    ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_user          ON refresh_tokens(user_id, role);

-- ─── Auto-update updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_voters_updated_at
  BEFORE UPDATE ON voters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_elections_updated_at
  BEFORE UPDATE ON elections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
