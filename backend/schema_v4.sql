-- ============================================================
-- schema_v4.sql  |  시스템 전면 재설계
-- 기존 테이블 제거 후 새 스키마 적용
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 기존 테이블 제거
DROP TABLE IF EXISTS chat_messages        CASCADE;
DROP TABLE IF EXISTS survey_responses     CASCADE;
DROP TABLE IF EXISTS surveys              CASCADE;
DROP TABLE IF EXISTS certifications       CASCADE;
DROP TABLE IF EXISTS accuracy_records     CASCADE;
DROP TABLE IF EXISTS daily_surveys        CASCADE;
DROP TABLE IF EXISTS users                CASCADE;

-- ── 사용자 (Supabase Auth와 연동) ──────────────────────────
-- id = auth.users.id (구글 로그인 시 Supabase가 자동 생성)
CREATE TABLE users (
    id               UUID PRIMARY KEY,
    email            TEXT UNIQUE NOT NULL,
    name             TEXT,
    telegram_chat_id BIGINT UNIQUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 날짜별 설문 (하루 1개) ─────────────────────────────────
CREATE TABLE daily_surveys (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_date      DATE UNIQUE NOT NULL,
    is_closed        BOOLEAN DEFAULT FALSE,
    kospi_result     BOOLEAN,          -- 장 마감 후: TRUE=상승
    kosdaq_result    BOOLEAN,
    kospi_change_pct FLOAT,            -- 실제 등락률
    kosdaq_change_pct FLOAT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 유저별 응답 (전날 15:35 ~ 당일 09:00 사이 허용) ─────────────────
CREATE TABLE survey_responses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    survey_date   DATE NOT NULL,
    kospi_answer  BOOLEAN NOT NULL,   -- TRUE=오른다 / FALSE=내린다
    kosdaq_answer BOOLEAN NOT NULL,
    responded_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, survey_date)
);

-- ── 정확도 기록 (15:35 이후 채움) ─────────────────────────
CREATE TABLE accuracy_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    survey_date     DATE NOT NULL,
    kospi_correct   BOOLEAN,
    kosdaq_correct  BOOLEAN,
    UNIQUE(user_id, survey_date)
);

-- ── 인덱스 ────────────────────────────────────────────────
CREATE INDEX idx_survey_responses_date   ON survey_responses(survey_date);
CREATE INDEX idx_survey_responses_user   ON survey_responses(user_id);
CREATE INDEX idx_accuracy_records_user   ON accuracy_records(user_id);
CREATE INDEX idx_accuracy_records_date   ON accuracy_records(survey_date);
CREATE INDEX idx_users_telegram          ON users(telegram_chat_id);
