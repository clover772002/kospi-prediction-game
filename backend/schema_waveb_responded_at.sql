-- 파도 B 인사이트: 제출 시각 컬럼 (schema_v4에 이미 포함된 배포면 IF NOT EXISTS로 무해)
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ DEFAULT NOW();
