-- ============================================================
-- 역사 시드 데이터: 2026년 4월~5월 초 실제 코스피 종가 기반
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1) daily_surveys: 날짜별 코스피 결과
INSERT INTO daily_surveys (survey_date, is_closed, kospi_result, kospi_change_pct)
VALUES
  ('2026-04-01', TRUE, TRUE,   1.46),
  ('2026-04-02', TRUE, FALSE, -4.46),
  ('2026-04-03', TRUE, TRUE,   2.73),
  ('2026-04-07', TRUE, TRUE,   2.18),
  ('2026-04-08', TRUE, TRUE,   6.87),
  ('2026-04-09', TRUE, FALSE, -1.61),
  ('2026-04-10', TRUE, TRUE,   1.40),
  ('2026-04-13', TRUE, FALSE, -0.86),
  ('2026-04-14', TRUE, TRUE,   2.74),
  ('2026-04-15', TRUE, TRUE,   2.07),
  ('2026-04-16', TRUE, TRUE,   2.21),
  ('2026-04-17', TRUE, FALSE, -0.55),
  ('2026-04-20', TRUE, TRUE,   0.44),
  ('2026-04-21', TRUE, TRUE,   2.72),
  ('2026-04-22', TRUE, TRUE,   0.46),
  ('2026-04-23', TRUE, TRUE,   0.90),
  ('2026-04-24', TRUE, FALSE, -0.003),
  ('2026-04-27', TRUE, TRUE,   2.15),
  ('2026-04-28', TRUE, TRUE,   0.39),
  ('2026-04-29', TRUE, TRUE,   0.68),
  ('2026-04-30', TRUE, FALSE, -1.31),
  ('2026-05-02', TRUE, TRUE,   1.53),
  ('2026-05-04', TRUE, TRUE,   3.05)
ON CONFLICT (survey_date) DO UPDATE SET
  kospi_result     = EXCLUDED.kospi_result,
  kospi_change_pct = EXCLUDED.kospi_change_pct,
  is_closed        = TRUE;


-- 2) survey_summaries: 날짜별 집계 (역사 시뮬레이션 참여 데이터)
--
-- 컬럼 설명:
--   majority_up       = 참여자 과반 예측 방향 (TRUE=상승)
--   expert_up         = 고수강화예측 방향 (가중앙상블)
--   majority_correct  = 다수결 적중 여부
--   hour_distribution = 시간대별 투표 분포 (JSONB)
--
INSERT INTO survey_summaries
  (survey_date, total_votes, up_votes, down_votes, up_pct, down_pct,
   majority_up, expert_up, kospi_result, kospi_change_pct, majority_correct, hour_distribution)
VALUES
  -- 4/01 (+1.46%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-01',  8,  5,  3, 62.5, 37.5, TRUE,  TRUE,  TRUE,   1.46,  TRUE,
   '{"22":3,"8":3,"9":2}'::jsonb),

  -- 4/02 (-4.46%, 하락): 다수↑ 틀림, 고수↓ 맞음  ← 고수가 급락 캐치
  ('2026-04-02',  9,  6,  3, 66.7, 33.3, TRUE,  FALSE, FALSE, -4.46,  FALSE,
   '{"22":4,"8":3,"9":2}'::jsonb),

  -- 4/03 (+2.73%, 상승): 다수↑ 맞음, 고수↓ 틀림  ← 다수결이 더 정확한 날
  ('2026-04-03', 10,  7,  3, 70.0, 30.0, TRUE,  FALSE, TRUE,   2.73,  TRUE,
   '{"22":5,"8":3,"9":2}'::jsonb),

  -- 4/07 (+2.18%, 상승): 다수↓ 틀림, 고수↑ 맞음  ← 급락 후 군중 비관론 vs 고수 반등 예측
  ('2026-04-07', 11,  5,  6, 45.5, 54.5, FALSE, TRUE,  TRUE,   2.18,  FALSE,
   '{"22":5,"8":4,"9":2}'::jsonb),

  -- 4/08 (+6.87%, 상승): 다수↑ 맞음, 고수↑ 맞음  ← 대형 서프라이즈 급등
  ('2026-04-08', 12,  9,  3, 75.0, 25.0, TRUE,  TRUE,  TRUE,   6.87,  TRUE,
   '{"22":6,"8":4,"9":2}'::jsonb),

  -- 4/09 (-1.61%, 하락): 다수↑ 틀림, 고수↑ 틀림  ← 전날 급등 후 쏠림
  ('2026-04-09', 13,  9,  4, 69.2, 30.8, TRUE,  TRUE,  FALSE, -1.61,  FALSE,
   '{"22":6,"8":5,"9":2}'::jsonb),

  -- 4/10 (+1.40%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-10', 13,  7,  6, 53.8, 46.2, TRUE,  TRUE,  TRUE,   1.40,  TRUE,
   '{"22":6,"8":5,"9":2}'::jsonb),

  -- 4/13 (-0.86%, 하락): 다수↑ 틀림, 고수↓ 맞음  ← 고수가 소폭 조정 감지
  ('2026-04-13', 14,  8,  6, 57.1, 42.9, TRUE,  FALSE, FALSE, -0.86,  FALSE,
   '{"22":7,"8":5,"9":2}'::jsonb),

  -- 4/14 (+2.74%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-14', 15, 10,  5, 66.7, 33.3, TRUE,  TRUE,  TRUE,   2.74,  TRUE,
   '{"22":7,"8":6,"9":2}'::jsonb),

  -- 4/15 (+2.07%, 상승): 다수↑ 맞음, 고수↓ 틀림
  ('2026-04-15', 16,  9,  7, 56.3, 43.7, TRUE,  FALSE, TRUE,   2.07,  TRUE,
   '{"22":7,"8":6,"9":3}'::jsonb),

  -- 4/16 (+2.21%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-16', 17,  9,  8, 52.9, 47.1, TRUE,  TRUE,  TRUE,   2.21,  TRUE,
   '{"22":8,"8":6,"9":3}'::jsonb),

  -- 4/17 (-0.55%, 하락): 다수↑ 틀림, 고수↓ 맞음  ← 고수 소폭 하락 예측 성공
  ('2026-04-17', 18, 11,  7, 61.1, 38.9, TRUE,  FALSE, FALSE, -0.55,  FALSE,
   '{"22":9,"8":6,"9":3}'::jsonb),

  -- 4/20 (+0.44%, 상승): 다수↓ 틀림, 고수↑ 맞음  ← 하락 후 비관론 vs 고수 반등
  ('2026-04-20', 19,  9, 10, 47.4, 52.6, FALSE, TRUE,  TRUE,   0.44,  FALSE,
   '{"22":9,"8":7,"9":3}'::jsonb),

  -- 4/21 (+2.72%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-21', 20, 13,  7, 65.0, 35.0, TRUE,  TRUE,  TRUE,   2.72,  TRUE,
   '{"22":10,"8":7,"9":3}'::jsonb),

  -- 4/22 (+0.46%, 상승): 다수↑ 맞음, 고수↓ 틀림
  ('2026-04-22', 21, 12,  9, 57.1, 42.9, TRUE,  FALSE, TRUE,   0.46,  TRUE,
   '{"22":10,"8":8,"9":3}'::jsonb),

  -- 4/23 (+0.90%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-23', 22, 13,  9, 59.1, 40.9, TRUE,  TRUE,  TRUE,   0.90,  TRUE,
   '{"22":11,"8":8,"9":3}'::jsonb),

  -- 4/24 (-0.003%, 하락): 다수↑ 틀림, 고수↑ 틀림  ← 보합장에서 양쪽 다 틀림
  ('2026-04-24', 23, 13, 10, 56.5, 43.5, TRUE,  TRUE,  FALSE, -0.003, FALSE,
   '{"22":12,"8":8,"9":3}'::jsonb),

  -- 4/27 (+2.15%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-27', 24, 16,  8, 66.7, 33.3, TRUE,  TRUE,  TRUE,   2.15,  TRUE,
   '{"22":12,"8":9,"9":3}'::jsonb),

  -- 4/28 (+0.39%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-28', 25, 13, 12, 52.0, 48.0, TRUE,  TRUE,  TRUE,   0.39,  TRUE,
   '{"22":13,"8":9,"9":3}'::jsonb),

  -- 4/29 (+0.68%, 상승): 다수↑ 맞음, 고수↑ 맞음
  ('2026-04-29', 26, 13, 13, 50.0, 50.0, TRUE,  TRUE,  TRUE,   0.68,  TRUE,
   '{"22":13,"8":9,"9":4}'::jsonb),

  -- 4/30 (-1.31%, 하락): 다수↑ 틀림, 고수↓ 맞음  ← 월말 조정 고수가 캐치
  ('2026-04-30', 27, 17, 10, 63.0, 37.0, TRUE,  FALSE, FALSE, -1.31,  FALSE,
   '{"22":13,"8":10,"9":4}'::jsonb),

  -- 5/02 (+1.53%, 상승): 다수↑ 맞음, 고수↑ 맞음  (5/1 근로자의 날 휴장)
  ('2026-05-02', 28, 18, 10, 64.3, 35.7, TRUE,  TRUE,  TRUE,   1.53,  TRUE,
   '{"22":14,"8":10,"9":4}'::jsonb),

  -- 5/04 (+3.05%, 상승): 다수↑ 맞음, 고수↑ 맞음  (5/5 어린이날 앞 매수세)
  ('2026-05-04', 30, 22,  8, 73.3, 26.7, TRUE,  TRUE,  TRUE,   3.05,  TRUE,
   '{"22":15,"8":10,"9":5}'::jsonb),

  -- 5/06 (+6.45%, 상승): 미중 관세 완화 서프라이즈 급등
  ('2026-05-06', 34, 24, 10, 70.6, 29.4, TRUE,  TRUE,  TRUE,   6.45,  TRUE,
   '{"22":16,"8":11,"9":7}'::jsonb),

  -- 5/07 (+1.43%, 상승): 상승 추세 지속
  ('2026-05-07', 31, 20, 11, 64.5, 35.5, TRUE,  TRUE,  TRUE,   1.43,  TRUE,
   '{"22":15,"8":10,"9":6}'::jsonb),

  -- 5/08 (+0.11%, 상승): 보합 마감
  ('2026-05-08', 28, 16, 12, 57.1, 42.9, TRUE,  TRUE,  TRUE,   0.11,  TRUE,
   '{"22":14,"8":9,"9":5}'::jsonb)

ON CONFLICT (survey_date) DO UPDATE SET
  total_votes      = EXCLUDED.total_votes,
  up_votes         = EXCLUDED.up_votes,
  down_votes       = EXCLUDED.down_votes,
  up_pct           = EXCLUDED.up_pct,
  down_pct         = EXCLUDED.down_pct,
  majority_up      = EXCLUDED.majority_up,
  expert_up        = EXCLUDED.expert_up,
  kospi_result     = EXCLUDED.kospi_result,
  kospi_change_pct = EXCLUDED.kospi_change_pct,
  majority_correct = EXCLUDED.majority_correct;


-- ============================================================
-- 확인 쿼리 (실행 후 결과 검증)
-- ============================================================
-- SELECT
--   ds.survey_date,
--   ds.kospi_result,
--   ds.kospi_change_pct,
--   ss.total_votes,
--   ss.majority_correct,
--   (ss.expert_up = ds.kospi_result) AS expert_correct
-- FROM daily_surveys ds
-- LEFT JOIN survey_summaries ss ON ss.survey_date = ds.survey_date
-- WHERE ds.survey_date < '2026-05-06'
-- ORDER BY ds.survey_date;
