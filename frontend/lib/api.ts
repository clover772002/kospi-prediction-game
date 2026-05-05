const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function authFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "오류가 발생했습니다." }));
    throw new Error(err.detail || "오류가 발생했습니다.");
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
}

export interface TodaySurvey {
  status: "no_survey" | "open" | "closed" | "result";
  survey_date: string;
  total_responses: number;
  kospi_yes_pct: number | null;
  kosdaq_yes_pct: number | null;
  kospi_result: boolean | null;
  kosdaq_result: boolean | null;
  kospi_change_pct: number | null;
  kosdaq_change_pct: number | null;
}

export interface HistoryItem {
  date: string;
  kospi_answer: boolean;
  kosdaq_answer: boolean;
  kospi_correct: boolean | null;
  kosdaq_correct: boolean | null;
}

export interface DashboardData {
  accuracy: {
    kospi: number | null;
    kosdaq: number | null;
    overall: number | null;
  };
  percentile: number | null;
  history: HistoryItem[];
  total_predictions: number;
}

// ─── API 함수 ────────────────────────────────────────────────

export async function getMe(token: string): Promise<UserProfile> {
  return authFetch<UserProfile>("/api/me", token);
}

export async function getToday(): Promise<TodaySurvey> {
  const res = await fetch(`${API_BASE}/api/today`);
  if (!res.ok) throw new Error("오늘 데이터 조회 실패");
  return res.json();
}

export async function getDashboard(token: string): Promise<DashboardData> {
  return authFetch<DashboardData>("/api/dashboard", token);
}
