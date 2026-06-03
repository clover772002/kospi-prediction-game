import type { TodaySurvey } from "@/lib/api";

/** 서버 응답 전 설문 탭 즉시 페인트용 (KST 기준) */
export function buildKstSurveyTodayPlaceholder(): TodaySurvey {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
  const isWeekend = day === 0 || day === 6;
  return {
    status: isWeekend ? "no_survey" : "open",
    survey_date: todayStr,
    total_responses: 0,
    kospi_yes_pct: null,
    kospi_weighted_pct: null,
    kospi_result: null,
    kospi_change_pct: null,
  };
}
