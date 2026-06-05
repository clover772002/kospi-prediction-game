/** 대회 모드·랜딩 카피 (생존전 / 적중대결) */

export type TournamentMode = "survival" | "accuracy";

export const TOURNAMENT_MODE_STORAGE_KEY = "tournament_mode_preference";

export const SURVIVAL_MODE = {
  id: "survival" as const,
  emoji: "🔥",
  name: "생존전",
  badge: "하드코어",
  tagline: "틀리면 탈락 · 미제출도 탈락",
  description: "5거래일 동안 매일 코스피 방향을 맞춰야 생존합니다. 한 번 틀리거나 09:00 전에 안 내면 즉시 탈락.",
  bullets: ["탈락제 · 긴장감", "생존 인증서", "인스타 생존 현황"],
} as const;

export const ACCURACY_MODE = {
  id: "accuracy" as const,
  emoji: "📊",
  name: "적중대결",
  badge: "일반",
  tagline: "틀려도 끝까지 · 적중률 순위",
  description: "하루 틀려도 시즌 끝까지 참여합니다. 기간 적중률로 순위가 정해지고, 인증서로 실력을 자랑할 수 있어요.",
  bullets: ["순위제 · 부담 적음", "적중률 TOP", "시즌 랭킹"],
} as const;

export const TOURNAMENT_LANDING = {
  headline: "이번 시즌 코스피 대결",
  subhead: "매일 09:00 전 제출 · 한 번의 예측으로 두 대회 동시 참가",
  seasonNote: "5거래일 시즌 · 투자 조언·매매 권유 아님",
  ctaHint: "모드를 고른 뒤 로그인하면 대회 참가가 시작됩니다",
  loginTitle: "대회 참가하기",
} as const;
