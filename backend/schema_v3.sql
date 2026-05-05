-- 똥손인증대결 v3 스키마 추가분
-- Supabase SQL Editor에서 실행하세요.

-- surveys 테이블에 대상 등급 범위 컬럼 추가
-- 빈 배열([])이면 전체 대상, 배열에 등급이 있으면 해당 등급만 대상
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS target_grades JSONB NOT NULL DEFAULT '[]';
