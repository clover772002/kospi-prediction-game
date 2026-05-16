-- accuracy_records 를 유저별로 한 번에 집계 (기존 Python range 전체 스캔 대체)
-- Supabase SQL Editor에서 실행한 뒤 배포하면 /api/today·대시보드·텔레그램 가중치가 빨라집니다.

CREATE OR REPLACE FUNCTION public.get_kospi_accuracy_aggregates()
RETURNS TABLE (
  user_id uuid,
  correct bigint,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ar.user_id,
    COALESCE(
      SUM(CASE WHEN ar.kospi_correct IS TRUE THEN 1 ELSE 0 END),
      0
    )::bigint AS correct,
    COUNT(*)::bigint AS total
  FROM public.accuracy_records ar
  GROUP BY ar.user_id;
$$;

COMMENT ON FUNCTION public.get_kospi_accuracy_aggregates() IS
  '코스피 적중 집계: 유저별 correct/total (가중 예측·percentile용)';

-- API(서비스 롤)에서만 호출 — anon 에게는 열지 않음
GRANT EXECUTE ON FUNCTION public.get_kospi_accuracy_aggregates() TO service_role;
