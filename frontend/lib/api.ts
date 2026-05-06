/**
 * 백엔드 URL 결정 (브라우저/서버 공통).
 * NEXT_PUBLIC_BACKEND_URL 또는 NEXT_PUBLIC_API_URL 환경변수에서 가져오며,
 * http:// 로 시작하는 공개 도메인은 https:// 로 자동 보정.
 */
export function resolveApiBase(): string {
  const raw = (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  let base = raw || "http://localhost:8000";
  if (base.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(base)) {
    base = "https://" + base.slice("http://".length);
  }
  return base;
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
