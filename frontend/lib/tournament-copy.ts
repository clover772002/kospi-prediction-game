/** 대회 랜딩 카피 */

export const TOURNAMENT_RULES = {
  title: "대회 규칙",
  period: "주 단위 · 해당 주 거래일(월~금)",
  summary: "틀리면 탈락 · 안 내면 탈락",
  intro:
    "매 거래일 장 전에 코스피 방향을 제출합니다. 한 주 동안 끝까지 버티면 주간 통과입니다.",
  rules: [
    "매 거래일 09:00 전, 코스피 방향 1회 제출",
    "방향이 맞으면 생존, 틀리거나 미제출이면 즉시 탈락",
    "제출은 하루 한 번 · 휴장일은 판정 없음",
  ],
  rewards: ["생존 인증서", "경품 (주간 당첨자, 사전 공지)"],
  footnote: "탈락 여부와 함께 내 적중률도 결과에서 확인할 수 있어요.",
} as const;

export const TOURNAMENT_LANDING = {
  headline: "투자 실력 검증",
  subhead: "매주 코스피 방향을 맞히고, 기록으로 실력을 증명하세요",
  disclaimer: "투자 조언·매매 권유가 아닙니다",
  ctaHint: "로그인하면 이번 주 대회 참가가 시작됩니다",
  loginTitle: "대회 참가하기",
} as const;
