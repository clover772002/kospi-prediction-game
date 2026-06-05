/** 대회 랜딩 카피 (생존전 단일) */

export const SURVIVAL_MODE = {
  name: "생존전",
  badge: "하드코어",
  tagline: "틀리면 탈락 · 미제출도 탈락",
  description: "매일 코스피 방향을 맞춰야 생존합니다. 한 번 틀리거나 09:00 전에 안 내면 즉시 탈락.",
  bullets: ["보상: 생존 인증서", "경품: 시즌 당첨자"],
} as const;

export const TOURNAMENT_LANDING = {
  headline: "투자 실력 검증",
  subhead: "매일 코스피 방향을 맞히고, 기록으로 실력을 증명하세요",
  disclaimer: "투자 조언·매매 권유가 아닙니다",
  ctaHint: "로그인하면 생존전 참가가 시작됩니다",
  loginTitle: "대회 참가하기",
} as const;
