-- 설문 재투표·게이지만 조정·방향 플립·예약·연승 보호 레이크백(hold)용 보조 테이블
-- Supabase SQL Editor에서 실행 (기존 DB 보존용 추가 마이그레이션).

CREATE TABLE IF NOT EXISTS survey_response_edit_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  survey_date DATE NOT NULL,
  grant_kind TEXT NOT NULL CHECK (grant_kind IN ('redo_full', 'gauge_only', 'flip_direction')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_edit_grant_one_pending_per_date
  ON survey_response_edit_grant (user_id, survey_date)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_survey_edit_grant_user ON survey_response_edit_grant (user_id, survey_date DESC);

COMMENT ON TABLE survey_response_edit_grant IS '재투표·게이지만·방향플립 소모품 구매 후 1회 사용 전까지 보관';


CREATE TABLE IF NOT EXISTS survey_vote_presubmit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  survey_date DATE NOT NULL,
  gauge_position SMALLINT NOT NULL,
  canceled_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_presubmit_one_active
  ON survey_vote_presubmit (user_id, survey_date)
  WHERE canceled_at IS NULL AND applied_at IS NULL;

COMMENT ON TABLE survey_vote_presubmit IS '예약 답변 소모품: 미적용건은 행 하나만 유지';


ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_shield_charges INTEGER NOT NULL DEFAULT 0;

ALTER TABLE survey_response_edit_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_vote_presubmit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_response_edit_grant_svc" ON survey_response_edit_grant FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "survey_vote_presubmit_svc" ON survey_vote_presubmit FOR ALL USING (false) WITH CHECK (false);

