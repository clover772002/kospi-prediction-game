-- 똥손인증대결 Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.

-- 인증 테이블 (사용자 수익률 인증 기록)
CREATE TABLE IF NOT EXISTS certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  return_rate NUMERIC(8, 2) NOT NULL,   -- 수익률 (예: -67.30)
  grade TEXT NOT NULL,                   -- 등급명 (심해층, 지하층, 지층, 지상층, 견습생)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 채팅 메시지 테이블 (등급별 소통방)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL,
  grade TEXT NOT NULL,       -- 어느 등급방에서 작성했는지
  room TEXT NOT NULL,        -- 'all' | '심해층' | '지하층' | '지층' | '지상층'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER certifications_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) 활성화
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (랭킹 공개)
CREATE POLICY "certifications_public_read"
  ON certifications FOR SELECT USING (true);

-- 누구나 삽입/수정 가능 (닉네임 기반 인증)
CREATE POLICY "certifications_public_write"
  ON certifications FOR INSERT WITH CHECK (true);

CREATE POLICY "certifications_public_update"
  ON certifications FOR UPDATE USING (true);

-- 채팅: 누구나 읽기
CREATE POLICY "chat_public_read"
  ON chat_messages FOR SELECT USING (true);

-- 채팅: 누구나 작성
CREATE POLICY "chat_public_write"
  ON chat_messages FOR INSERT WITH CHECK (true);

-- 랭킹 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_certifications_return_rate
  ON certifications (return_rate ASC);

CREATE INDEX IF NOT EXISTS idx_certifications_grade
  ON certifications (grade);

CREATE INDEX IF NOT EXISTS idx_chat_room_created
  ON chat_messages (room, created_at DESC);
