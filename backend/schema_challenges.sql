-- ============================================================
-- schema_challenges.sql  |  대결 기능 테이블
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    challenged_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    survey_date     DATE NOT NULL,
    outcome         TEXT DEFAULT 'pending',
    -- 'pending' | 'challenger_wins' | 'challenged_wins' | 'tie' | 'no_result'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(challenger_id, challenged_id, survey_date)
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_date       ON challenges(survey_date);

-- 반응 이모티콘 (결과 확정 후 상대방에게 보내는 1회성 반응)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenger_reaction TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenged_reaction TEXT;
