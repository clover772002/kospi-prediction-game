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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  telegram_chat_id: number | null;
  has_push: boolean;
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
  date: string,
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

export async function nudgeGroup(
  token: string,
  group_id: string,
): Promise<{ ok: boolean; notified: number; message: string }> {
  return authFetch(`/api/groups/${group_id}/nudge`, token, { method: "POST" });
}

export async function requestRematch(
  token: string,
  challenge_id: string,
): Promise<{ ok: boolean; challenge_id?: string; survey_date?: string }> {
  return authFetch(`/api/challenges/${challenge_id}/rematch`, token, { method: "POST" });
}
