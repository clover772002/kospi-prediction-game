import type {
  CrowdGaugeBoxplotDay,
  CrowdGaugeBoxplotStats,
  DashboardData,
  HistoryItem,
  TodaySurvey,
} from "@/lib/api";

function sameSurveyDate(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().slice(0, 10) === b.trim().slice(0, 10);
}

function fmtGaugeMedian(stats: CrowdGaugeBoxplotStats | null, variant: "rise" | "fall"): string {
  if (!stats || stats.n === 0) return "—";
  const m = stats.median;
  if (variant === "rise") return `중앙 +${Math.round(m)}`;
  return `중앙 ${Math.round(m)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v}%`;
}

export type DashboardCombinedShareInput = {
  today: TodaySurvey;
  dash: DashboardData;
  crowdDay: CrowdGaugeBoxplotDay | null;
  todayEntry?: HistoryItem;
  isCorrectToday: boolean | null;
  appUrl: string;
};

export function buildDashboardCombinedShare(input: DashboardCombinedShareInput): {
  title: string;
  text: string;
} {
  const { today, dash, crowdDay, todayEntry, isCorrectToday, appUrl } = input;
  const sd = today.survey_date?.slice(0, 10) ?? "오늘";

  const lines: string[] = [`📊 코스피 집단 예측 · 내 실적 (${sd})`, ""];

  lines.push("【전체 예측 방향 / 확신 분포】");

  if (crowdDay) {
    const nRise = crowdDay.respondents_rise ?? crowdDay.rise?.n ?? 0;
    const nFall = crowdDay.respondents_fall ?? crowdDay.fall?.n ?? 0;
    const pctRise =
      typeof crowdDay.pct_rise === "number"
        ? crowdDay.pct_rise
        : nRise + nFall > 0
          ? Math.round((1000 * nRise) / (nRise + nFall)) / 10
          : null;
    const pctFall =
      typeof crowdDay.pct_fall === "number"
        ? crowdDay.pct_fall
        : pctRise != null
          ? Math.round((100 - pctRise) * 10) / 10
          : null;

    if (pctRise != null && pctFall != null) {
      lines.push(`방향: 상승 ${pctRise}% · 하락 ${pctFall}% (응답 ${nRise + nFall}명)`);
    }
    lines.push(
      `확신(상승선택 n=${nRise}): ${fmtGaugeMedian(crowdDay.rise, "rise")}`,
      `확신(하락선택 n=${nFall}): ${fmtGaugeMedian(crowdDay.fall, "fall")}`,
    );
    if (crowdDay.kospi_result === true) lines.push("장 마감: 상승");
    else if (crowdDay.kospi_result === false) lines.push("장 마감: 하락");
  } else if (today.kospi_yes_pct != null) {
    const up = today.kospi_yes_pct;
    const dn = Math.max(0, Math.min(100, 100 - up));
    lines.push(`방향: 상승 ${up}% · 하락 ${dn}%`);
    if (today.total_responses) lines.push(`응답 ${today.total_responses}명`);
  } else {
    lines.push("집단 집계 준비 중");
  }

  if (today.kospi_weighted_pct != null) {
    lines.push(`고수강화예측: ${today.kospi_weighted_pct >= 50 ? "상승" : "하락"} ${fmtPct(today.kospi_weighted_pct)}`);
  }

  lines.push("", "【내 통계 · 실적】");

  if (dash.accuracy?.kospi != null) {
    lines.push(`누적 적중률 ${dash.accuracy.kospi}% · ${dash.total_predictions}일 참여`);
  } else {
    lines.push(`참여 ${dash.total_predictions}일`);
  }

  if (dash.tokens != null) {
    lines.push(`보유 토큰 ${dash.tokens.toLocaleString()}`);
  }
  if (dash.current_streak != null && dash.current_streak > 0) {
    lines.push(`연속 적중 ${dash.current_streak}일`);
  }

  if (todayEntry) {
    const pick = todayEntry.kospi_answer ? "상승" : "하락";
    const gp =
      todayEntry.gauge_position != null
        ? ` · 확신 ${todayEntry.gauge_position > 0 ? "+" : ""}${todayEntry.gauge_position}`
        : "";
    let verdict = "";
    if (isCorrectToday === true) verdict = " ✅ 맞음";
    else if (isCorrectToday === false) verdict = " ❌ 틀림";
    else if (todayEntry.kospi_correct === true) verdict = " ✅ 맞음";
    else if (todayEntry.kospi_correct === false) verdict = " ❌ 틀림";
    lines.push(`오늘 예측: ${pick}${gp}${verdict}`);
  } else if (sameSurveyDate(dash.history?.[0]?.date, today.survey_date)) {
    const h = dash.history[0];
    const pick = h.kospi_answer ? "상승" : "하락";
    lines.push(`오늘 예측: ${pick}`);
  }

  lines.push("", "코스피 예측에 참여해 보세요 👇", appUrl);

  return {
    title: "코스피 집단 예측 · 내 실적",
    text: lines.join("\n"),
  };
}
