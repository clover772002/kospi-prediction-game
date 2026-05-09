const RAILWAY_URL = "https://kospi-prediction-game-production.up.railway.app";

/**
 * 백엔드 URL 반환.
 * 환경변수가 설정되어 있으면 우선 사용, 없으면 Railway URL 직접 사용.
 */
export function resolveApiBase(): string {
  const envUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).trim().replace(/\/$/, "");
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.startsWith("https://") ? envUrl : "https://" + envUrl.replace(/^https?:\/\//, "");
  }
  return RAILWAY_URL;
}

async function authFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const detail =
      typeof raw.detail === "string"
        ? raw.detail
        : Array.isArray(raw.detail) && raw.detail[0]?.msg
          ? String(raw.detail[0].msg)
          : "오류가 발생했습니다.";
    throw new Error(detail);
  }
  return res.json();
}

// ─── 타입 ────────────────────────────────────────────────────

export interface PushPreferences {
  survey_open:    boolean;
  survey_deadline:boolean;
  result:         boolean;
  challenge:      boolean;
  group_nudge:    boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  telegram_chat_id: number | null;
  has_push: boolean;
  push_preferences?: PushPreferences;
}

export interface TopPredictor {
  masked_name: string;
  kospi_answer: boolean;
  accuracy: number;
  total_predictions: number;
}

export interface Participant {
  user_id: string;
  masked_name: string;
  kospi_answer: boolean;
  accuracy: number | null;
  total_predictions: number;
}

// ─── 그룹 타입 ───────────────────────────────────────────────
export interface Group {
  group_id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  member_count: number;
}

export interface GroupMember {
  user_id: string;
  masked_name: string;
  is_me: boolean;
  accuracy: number | null;
  total_predictions: number;
  correct: number;
  rank: number;
  voted_today: boolean;
}

export interface GroupLeaderboard {
  group_id: string;
  group_name: string;
  invite_code: string;
  members: GroupMember[];
}

export type ChallengeOutcome = "pending" | "challenger_wins" | "challenged_wins" | "tie" | "no_result";

export interface Challenge {
  id: string;
  opponent_masked_name: string;
  opponent_id: string;
  outcome: ChallengeOutcome;
  survey_date: string;
  is_sent: boolean;
  my_reaction: string | null;
  opp_reaction: string | null;
  accepted: boolean | null;   // null=수락대기, true=수락, false=거절
  duel_group_id: string | null;
}

export interface TodaySurvey {
  status: "no_survey" | "open" | "closed" | "result";
  survey_date: string;
  total_responses: number;
  kospi_yes_pct: number | null;
  kospi_weighted_pct: number | null;
  kospi_result: boolean | null;
  kospi_change_pct: number | null;
  top_predictor?: TopPredictor;
  worst_predictor?: TopPredictor;
  participants?: Participant[];
}

export interface HistoryItem {
  date: string;
  kospi_answer: boolean;
  kospi_correct: boolean | null;
  gauge_position?: number | null;
  tokens_bet?: number | null;
  tokens_won?: number | null;
  payout_multiplier?: number | null;
}

export interface DashboardData {
  accuracy: {
    kospi: number | null;
    overall: number | null;
  };
  percentile: number | null;
  contribution: number | null;
  history: HistoryItem[];
  total_predictions: number;
  tokens?: number;
  current_streak?: number;
}

// ─── API 함수 ────────────────────────────────────────────────

export async function getMe(token: string): Promise<UserProfile> {
  return authFetch<UserProfile>("/api/me", token);
}

export async function getToday(): Promise<TodaySurvey> {
  const res = await fetch(`${resolveApiBase()}/api/today`);
  if (!res.ok) throw new Error("오늘 데이터 조회 실패");
  return res.json();
}

export async function getDashboard(token: string): Promise<DashboardData> {
  return authFetch<DashboardData>("/api/dashboard", token);
}

export async function unlinkTelegram(token: string): Promise<void> {
  await authFetch<{ success: boolean }>("/api/me/telegram", token, { method: "DELETE" });
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${resolveApiBase()}/api/vapid-public-key`);
  if (!res.ok) throw new Error("VAPID 키 조회 실패");
  const data = await res.json();
  return data.public_key;
}

export async function savePushSubscription(token: string, subscription: PushSubscriptionJSON): Promise<void> {
  await authFetch<{ success: boolean }>("/api/me/push-subscription", token, {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

export async function deletePushSubscription(token: string): Promise<void> {
  await authFetch<{ success: boolean }>("/api/me/push-subscription", token, { method: "DELETE" });
}

export async function createChallenge(
  token: string,
  challenged_user_id: string,
  survey_date: string,
): Promise<{ ok: boolean; challenge_id?: string }> {
  return authFetch("/api/challenges", token, {
    method: "POST",
    body: JSON.stringify({ challenged_user_id, survey_date }),
  });
}

export async function getMyChallenges(
  token: string,
  date?: string,
): Promise<{ sent: Challenge[]; received: Challenge[] }> {
  return authFetch(`/api/challenges/me?date=${date}`, token);
}

export async function reactToChallenge(
  token: string,
  challenge_id: string,
  reaction: string,
): Promise<{ ok: boolean }> {
  return authFetch(`/api/challenges/${challenge_id}/react`, token, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

export async function createGroup(token: string, name: string): Promise<{ ok: boolean; group_id: string; invite_code: string }> {
  return authFetch("/api/groups", token, { method: "POST", body: JSON.stringify({ name }) });
}

export async function joinGroup(token: string, invite_code: string): Promise<{ ok: boolean; group_id: string; group_name: string }> {
  return authFetch("/api/groups/join", token, { method: "POST", body: JSON.stringify({ invite_code }) });
}

export async function getMyGroups(token: string): Promise<Group[]> {
  return authFetch("/api/groups/me", token);
}

export async function getGroupLeaderboard(token: string, group_id: string): Promise<GroupLeaderboard> {
  return authFetch(`/api/groups/${group_id}/leaderboard`, token);
}

export async function leaveGroup(token: string, group_id: string): Promise<{ ok: boolean }> {
  return authFetch(`/api/groups/${group_id}/leave`, token, { method: "DELETE" });
}

export async function savePushPreferences(
  token: string,
  prefs: PushPreferences,
): Promise<{ success: boolean }> {
  return authFetch("/api/me/push-preferences", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}

export async function nudgeGroup(
  token: string,
  group_id: string,
): Promise<{ ok: boolean; notified: number; message: string }> {
  return authFetch(`/api/groups/${group_id}/nudge`, token, { method: "POST" });
}

export async function acceptChallenge(
  token: string,
  challenge_id: string,
): Promise<{ ok: boolean; group_id: string; group_name: string }> {
  return authFetch(`/api/challenges/${challenge_id}/accept`, token, { method: "POST" });
}

export async function declineChallenge(
  token: string,
  challenge_id: string,
): Promise<{ ok: boolean }> {
  return authFetch(`/api/challenges/${challenge_id}/decline`, token, { method: "POST" });
}

export async function requestRematch(
  token: string,
  challenge_id: string,
): Promise<{ ok: boolean; challenge_id?: string; survey_date?: string }> {
  return authFetch(`/api/challenges/${challenge_id}/rematch`, token, { method: "POST" });
}

// ─── 상점 · 인사이트 (토큰/결제 플랜) ────────────────────────

export interface ExpertGapInsightResponse {
  accessible: boolean;
  locked?: boolean;
  reason?: string;
  survey_date: string;
  product_slug?: string;
  price_tokens?: number;
  balance?: number;
  title?: string;
  description?: string;
  data: {
    survey_date: string;
    total_responses: number;
    simple_pct: number;
    weighted_pct: number;
    gap_points: number;
    bullets: string[];
    computed_note?: string;
    highlight?: string;
  } | null;
}

export class InsightInsufficientTokensError extends Error {
  detail: { error?: string; required?: number; balance?: number };
  constructor(detail: { error?: string; required?: number; balance?: number }) {
    super("insufficient_tokens");
    this.name = "InsightInsufficientTokensError";
    this.detail = detail;
  }
}

export async function getExpertGapInsight(accessToken: string, surveyDate: string): Promise<ExpertGapInsightResponse> {
  const res = await fetch(
    `${resolveApiBase()}/api/insights/daily-expert-gap?survey_date=${encodeURIComponent(surveyDate)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const detail =
      typeof raw.detail === "string"
        ? raw.detail
        : "인사이트를 불러오지 못했습니다.";
    throw new Error(detail);
  }
  return res.json();
}

export interface GaugeCrowdInsightResponse {
  accessible: boolean;
  locked?: boolean;
  reason?: string | null;
  survey_date: string;
  product_slug?: string;
  price_tokens?: number;
  balance?: number;
  title?: string;
  description?: string;
  data: {
    survey_date: string;
    my_gauge: number;
    direction_label: string;
    cohort_size: number;
    opposite_side_count: number;
    total_with_gauge: number;
    median_abs_in_cohort: number;
    strength_vs_cohort_pct: number;
    conviction_band: string;
    bullets: string[];
    computed_note?: string;
  } | null;
}

export async function getGaugeCrowdInsight(accessToken: string, surveyDate: string): Promise<GaugeCrowdInsightResponse> {
  const res = await fetch(
    `${resolveApiBase()}/api/insights/my-gauge-vs-crowd?survey_date=${encodeURIComponent(surveyDate)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const detail =
      typeof raw.detail === "string"
        ? raw.detail
        : "인사이트를 불러오지 못했습니다.";
    throw new Error(detail);
  }
  return res.json();
}

export async function unlockInsightProduct(
  accessToken: string,
  body: { product_slug: string; survey_date: string; idempotency_key: string },
): Promise<{ ok: boolean; balance?: number; spent?: number; already_unlocked?: boolean }> {
  const res = await fetch(`${resolveApiBase()}/api/insights/unlock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    const raw = await res.json().catch(() => ({}));
    const d = raw.detail;
    throw new InsightInsufficientTokensError(
      typeof d === "object" && d !== null && !Array.isArray(d)
        ? (d as { error?: string; required?: number; balance?: number })
        : {},
    );
  }
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    throw new Error(typeof raw.detail === "string" ? raw.detail : "잠금 해제에 실패했습니다.");
  }
  return res.json();
}

export interface ShopCatalog {
  insight_products: { slug: string; title: string; price_tokens: number; description?: string }[];
  token_packs: { slug: string; tokens: number; price_label?: string; stripe_price_configured: boolean }[];
  stripe_ready: boolean;
  paywall_enabled: boolean;
}

export async function getShopCatalog(accessToken: string): Promise<ShopCatalog> {
  return authFetch("/api/shop/catalog", accessToken);
}

export async function createStripePackCheckout(accessToken: string, packSlug: string): Promise<{ url: string }> {
  const base =
    typeof window !== "undefined" ? `${window.location.origin}/shop` : "http://localhost:3000/shop";
  return authFetch<{ url: string }>("/api/shop/checkout-session", accessToken, {
    method: "POST",
    body: JSON.stringify({
      pack_slug: packSlug,
      success_url: `${base}?paid=1`,
      cancel_url: `${base}?cancel=1`,
    }),
  });
}
