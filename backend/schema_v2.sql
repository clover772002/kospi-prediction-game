-- 거지인증대결 v2 스키마 추가분
-- Supabase SQL Editor에서 실행하세요.

-- 텔레그램 연동 유저 테이블
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  telegram_id BIGINT NOT NULL UNIQUE,  -- Telegram chat_id
  telegram_username TEXT,
  grade TEXT NOT NULL DEFAULT '게스트',
  room TEXT NOT NULL DEFAULT 'all',    -- 소속 등급방
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 설문 테이블
CREATE TABLE IF NOT EXISTS surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room TEXT NOT NULL,                  -- 어느 방의 설문인지 ('all' | '심해층' | ...)
  question TEXT NOT NULL,              -- 설문 질문
  options JSONB NOT NULL DEFAULT '[]', -- 선택지 배열 (빈 배열이면 주관식)
  created_by TEXT NOT NULL,            -- 만든 사람 닉네임
  is_sent BOOLEAN DEFAULT FALSE,       -- 텔레그램 발송 여부
  is_closed BOOLEAN DEFAULT FALSE,     -- 마감 여부
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 설문 응답 테이블
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  response TEXT NOT NULL,              -- 선택지 또는 주관식 답변
  source TEXT NOT NULL DEFAULT 'web',  -- 'web' | 'telegram'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_id, nickname)          -- 1인 1회 응답 제한
);

-- RLS 활성화
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기/쓰기 가능
CREATE POLICY "telegram_users_all" ON telegram_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "surveys_read" ON surveys FOR SELECT USING (true);
CREATE POLICY "surveys_write" ON surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "surveys_update" ON surveys FOR UPDATE USING (true);
CREATE POLICY "survey_responses_all" ON survey_responses FOR ALL USING (true) WITH CHECK (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE surveys;
ALTER PUBLICATION supabase_realtime ADD TABLE survey_responses;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_surveys_room ON surveys (room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_room ON telegram_users (room);
