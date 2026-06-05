/** 대회 모드·랜딩 카피 (생존전 / 적중대결) */

export type TournamentMode = "survival" | "accuracy";

export const TOURNAMENT_MODE_STORAGE_KEY = "tournament_mode_preference";

export const SURVIVAL_MODE = {
  id: "survival" as const,
  name: "생존전",
  badge: "하드코어",
  tagline: "틀리면 탈락 · 미제출도 탈락",
  description: "매일 코스피 방향을 맞춰야 생존합니다. 한 번 틀리거나 09:00 전에 안 내면 즉시 탈락.",
  bullets: ["탈락제 · 긴장감", "생존 인증서", "실력 검증 기록"],
} as const;

export const ACCURACY_MODE = {
  id: "accuracy" as const,
  name: "적중대결",
  badge: "일반",
  tagline: "틀려도 끝까지 · 적중률 순위",
  description: "하루 틀려도 대회가 끝날 때까지 참여합니다. 기간 적중률로 순위가 정해지고, 인증서로 실력을 남길 수 있어요.",
  bullets: ["순위제 · 부담 적음", "적중률 TOP", "누적 랭킹"],
} as const;

export const TOURNAMENT_LANDING = {
  headline: "투자 실력 검증",
  subhead: "매일 코스피 방향을 맞히고, 기록으로 실력을 증명하세요",
  disclaimer: "투자 조언·매매 권유가 아닙니다",
  ctaHint: "모드를 고른 뒤 로그인하면 대회 참가가 시작됩니다",
  loginTitle: "대회 참가하기",
} as const;
