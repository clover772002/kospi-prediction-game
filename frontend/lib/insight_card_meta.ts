/** 인사이트 카드 헤더 안내 및 가격(backend/insights_catalog.py 의 price_tokens 과 동기화). instantExample 은 제목 아래 줄, hint 는 접는 상세(프론트 카피). */
export const INSIGHT_CARD_META = {
  daily_expert_gap: {
    priceTokens: 120,
    /** 카드 제목 바로 아래에 항상 보이는 짧은 예시 한 줄 */
    instantExample: "예: 그날 단순%·가중%·차이(pt) 요약 카드",
    hint:
      "해당 거래일 집계가 준비되면 열립니다. 누적 적중 반영 가중예측과 단순 다수결의 차이를 한 장으로 봅니다. 개별 응답은 포함하지 않습니다.",
  },
  rolling_crowd_summary: {
    priceTokens: 140,
    instantExample: "예: 최근 7거래일 날짜별 표 + 한 줄 무리 요약",
    hint:
      "가장 최근으로 잡히는 종료 거래일을 기준으로 최근 7거래일 구간을 묶습니다. 주말이면 직전 장일로 맞춥니다. 어떤 날은 표본이 적어 줄에서 빠질 수 있어요.",
  },
  group_vs_global_snapshot: {
    priceTokens: 110,
    instantExample: "예: 내 그룹 vs 전체, 같은 축(상·하) 하루 스냅샷",
    hint:
      "그날 선택한 그룹 응답이 8명 이상일 때만 열 수 있습니다. 같은 축으로 전체 무리와 하루치를 비교합니다.",
  },
  time_slice_accuracy: {
    priceTokens: 130,
    instantExample: "예: 장전·장중 등 시간 버킷별 응답·적중(확정 후)",
    hint:
      "제출 시각(responded_at)이 있는 응답만 집계합니다. 시각 미기록분은 제외되며, 코스피 결과 확정 전에는 분포만·확정 후에는 버킷별 적중이 덧붙을 수 있습니다.",
  },
  expert_vote_time_profile: {
    priceTokens: 100,
    instantExample: "예: 고수층만 — 제출 시각대 버킷 비율",
    hint:
      "누적 적중 기준 고수층만 묶습니다. 시간이 기록된 응답이 표본 규칙(전체·세그먼트)을 만족할 때 시간대 버킷 분포가 열립니다.",
  },
  novice_vote_time_profile: {
    priceTokens: 90,
    instantExample: "예: 하수층만 — 동일 규칙 시간대 분포",
    hint:
      "고수 카드와 같은 규칙으로 하위 층만 따로 묶습니다. 통계 비교용이며 비하 표현 없이 집계만 제공합니다.",
  },
  crowd_conviction_spread: {
    priceTokens: 60,
    instantExample: "예: 그날 게이지 ‘얼마나 확신했는지’ 분포 요약",
    hint:
      "같은 거래일에 게이지 응답이 최소 20명 모이면 확신 분포 요약을 열 수 있어요. 개별 원시값은 포함하지 않습니다.",
  },
  my_gauge_vs_crowd: {
    priceTokens: 80,
    instantExample: "예: 상승(또는 하락) 편 안에서 내 게이지가 상·중·하",
    hint:
      "그날 설문에 본인이 참여한 경우에만 토큰으로 열람됩니다. 같은 방향(상승·하락) 무리 속에서 내 게이지 위치를 봅니다.",
  },
} as const;

export type InsightProductSlug = keyof typeof INSIGHT_CARD_META;

export function insightMeta(slug: InsightProductSlug) {
  return INSIGHT_CARD_META[slug];
}
