/** INSIGHT_CARD_META: 가격은 backend/insights_catalog.py 와 동기화. instantExample 은 차트 아래 「한 줄 안내」접기 전용, hint 는 상세 설명 접기. */
export const INSIGHT_CARD_META = {
  daily_expert_gap: {
    priceTokens: 120,
    instantExample: "예: 참여%·우리 적중률%·차이(pt) 요약 카드",
    hint:
      "해당 거래일 집계가 준비되면 열립니다. 우리 적중률(누적 적중 반영)과 참여 집계를 같은 화면에 둡니다. 개별 응답은 포함하지 않습니다.",
  },
  rolling_crowd_summary: {
    priceTokens: 140,
    instantExample: "예: 최근 7거래일 · 우리 적중률 일별(0%·100%)",
    hint:
      "선택한 날을 끝으로 최근 거래일 7일 구간에서, 우리 적중률이 맞았는지(0%·100%)를 거래일별로 볼 수 있어요. 미확정일은 비워 둡니다.",
  },
  time_slice_accuracy: {
    priceTokens: 130,
    instantExample: "예: 적중률 1순위 한 명의 7거래일 제출 시각 버킷 분포",
    hint:
      "전체 무리에서 규격을 통과한 뒤 적중률 최고 참가자 1명을 고르고, 그 사람의 최근 7거래일 제출 시각(responded_at)만 시간대 버킷으로 요약합니다. 시각 미기록 응답은 제외됩니다.",
  },
  expert_vote_time_profile: {
    priceTokens: 100,
    instantExample: "예: 그날 맞힌 사람들만 — 제출 시각 버킷 비율",
    hint:
      "코스피 결과 확정 후에만 열립니다. 해당 거래일에 방향을 맞힌 응답 가운데 제출 시각이 있는 경우만 시간대 버킷 비율로 집계합니다.",
  },
  novice_vote_time_profile: {
    priceTokens: 90,
    instantExample: "예: 그날 틀린 사람들만 — 제출 시각 버킷 비율",
    hint:
      "코스피 결과 확정 후에만 열립니다. 그날 틀린 응답 중 제출 시각이 기록된 경우만 시간대 버킷으로 집계합니다.",
  },
  expert_leader_pick: {
    priceTokens: 95,
    instantExample: "예: 전역 최고 고수 — 그날 방향 + 확신도(게이지)",
    hint:
      "현재 칩 1위 고수가 그날 설문에 참여했을 때, 초성 이름과 함께 방향·확신도(게이지)·칩 잔액을 보여 줍니다.",
  },
  novice_leader_pick: {
    priceTokens: 85,
    instantExample: "예: 무리 규격 하수 중 그날 1순위 — 방향 + 확신도(게이지)",
    hint:
      "같은 규격 하수층에서 적중률 최저 참가자(동률 시 id순) 한 명의 그날 방향 선택과 게이지(확신도 규모)를 초성 이름과 함께 제공합니다.",
  },
  crowd_conviction_spread: {
    priceTokens: 60,
    instantExample: "예: 상승 택함 / 하락 택함 무리별 확신도(게이지) 통계",
    hint:
      "그날 코스피 상승을 선택한 무리와 하락을 선택한 무리로 나누어 각각 게이지(확신도) 분포를 요약합니다. 방향·게이지가 모두 있는 응답만 집계하며 최소 표본 규칙이 있어요.",
  },
} as const;

export type InsightProductSlug = keyof typeof INSIGHT_CARD_META;

export function insightMeta(slug: InsightProductSlug) {
  return INSIGHT_CARD_META[slug];
}

/** 카탈로그 문자열 등이 알려진 아이템 상품 슬러그인지(차트 미리보기 부착용). */
export function isInsightProductSlug(slug: string): slug is InsightProductSlug {
  return slug in INSIGHT_CARD_META;
}
