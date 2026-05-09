-- 추가 마이그레이션 (기존 스키마 보존) — Supabase SQL Editor에서 실행
-- 단일 재화(users.tokens): 인사이트 열람 차감 + 결제 충전을 ledger로 기록

CREATE TABLE IF NOT EXISTS token_ledger (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta              INTEGER NOT NULL,
  reason             TEXT NOT NULL,
  ref_type           TEXT,
  ref_id             TEXT,
  idempotency_key    TEXT UNIQUE,
  balance_after      INTEGER,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_ledger_user_created ON token_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS insight_entitlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug     TEXT NOT NULL,
  scope_key        TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('tokens', 'stripe', 'bonus')),
  idempotency_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_slug, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_insight_ent_user ON insight_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_ent_slug_scope ON insight_entitlements(product_slug, scope_key);

ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_ledger_service" ON token_ledger FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "insight_entitlements_service" ON insight_entitlements FOR ALL USING (false) WITH CHECK (false);
-- 서버는 service_role로 RLS 우회
