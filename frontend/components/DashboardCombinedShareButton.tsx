"use client";

import { useCallback, useState } from "react";
import ShareSheet from "@/components/ShareSheet";
import { buildDashboardCombinedShare } from "@/lib/build-dashboard-combined-share";
import {
  getCrowdGaugeBoxplots,
  type DashboardData,
  type HistoryItem,
  type TodaySurvey,
} from "@/lib/api";

function sameSurveyDate(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().slice(0, 10) === b.trim().slice(0, 10);
}

type Props = {
  today: TodaySurvey | null;
  dash: DashboardData | null;
  todayEntry?: HistoryItem;
  isCorrectToday: boolean | null;
  disabled?: boolean;
};

/** 전체 예측 방향/확신분포 + 내 통계를 한 번에 공유 */
export default function DashboardCombinedShareButton({
  today,
  dash,
  todayEntry,
  isCorrectToday,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [shareTitle, setShareTitle] = useState("코스피 집단 예측 · 내 실적");
  const [shareText, setShareText] = useState("");

  const buildPayload = useCallback(async () => {
    if (!today || !dash) return null;
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    let crowdDay = null;
    try {
      const box = await getCrowdGaugeBoxplots(30);
      const sd = today.survey_date?.slice(0, 10);
      crowdDay =
        box.days.find((d) => sameSurveyDate(d.survey_date, sd)) ?? box.days[0] ?? null;
    } catch {
      /* 방향만 today 요약으로 */
    }
    return buildDashboardCombinedShare({
      today,
      dash,
      crowdDay,
      todayEntry,
      isCorrectToday,
      appUrl,
    });
  }, [today, dash, todayEntry, isCorrectToday]);

  const runShare = useCallback(
    async (openSheet: () => void) => {
      if (!today || !dash) return;
      setLoading(true);
      try {
        const payload = await buildPayload();
        if (!payload) return;
        setShareTitle(payload.title);
        setShareText(payload.text);
        const url = typeof window !== "undefined" ? window.location.origin : "";
        if (typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share({ title: payload.title, text: payload.text, url });
            return;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
          }
        }
        openSheet();
      } finally {
        setLoading(false);
      }
    },
    [today, dash, buildPayload],
  );

  if (!today || !dash || dash.total_predictions === 0) return null;

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] fade-up-3">
      <p className="text-sm text-gray-400 mb-3 leading-relaxed">
        <span className="text-white font-bold">전체 예측 방향/확신분포</span>와{" "}
        <span className="text-white font-bold">내 통계</span>를 한 메시지로 보낼 수 있어요.
      </p>
      <ShareSheet
        url={shareUrl}
        title={shareTitle}
        text={shareText || "공유 내용을 불러오는 중…"}
        renderTrigger={(open) => (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => void runShare(open)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-black text-sm transition-all active:scale-[0.98]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {loading ? "공유 내용 준비 중…" : "집단 분포 + 내 실적 한번에 공유"}
          </button>
        )}
      />
    </div>
  );
}
