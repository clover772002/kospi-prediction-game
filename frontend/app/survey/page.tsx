"use client";

import { useEffect, useState, useCallback, useRef, Suspense, useLayoutEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getTodaySummary, getMe, TodaySurvey } from "@/lib/api";
import { peekDashboardSnapshot } from "@/lib/tab-session-cache";
import { markWasTopExpert } from "@/lib/top-expert-notice";
import { formatApiErrorMessage } from "@/lib/format-api-error";
import KospiPriceStrip from "@/components/KospiPriceStrip";
import GaugeBar from "@/components/GaugeBar";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import PageLoadProgress from "@/components/PageLoadProgress";
import AppTabNav from "@/components/AppTabNav";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";
import { clearAllTabSnapshots, peekSurveyTodaySnapshot, saveSurveyTodaySnapshot } from "@/lib/tab-session-cache";

interface KospiPrice {
  price: number | null;
  change: number | null;
  change_pct: number | null;
  is_up: boolean | null;
  code: string;
}

/** survey_date가 진짜 내일인지, 주말 넘긴 다음 거래일인지 판별 */
function getSurveyDayLabel(surveyDate: string): { isNextDay: boolean; label: string; shortLabel: string } {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const todayStr = `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,"0")}-${String(kst.getDate()).padStart(2,"0")}`;

  if (surveyDate <= todayStr) return { isNextDay: false, label: "오늘 예측", shortLabel: "오늘" };

  // 진짜 내일인지 확인
  const tom = new Date(kst); tom.setDate(tom.getDate() + 1);
  const tomorrowStr = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,"0")}-${String(tom.getDate()).padStart(2,"0")}`;

  if (surveyDate === tomorrowStr) {
    return { isNextDay: true, label: "내일 예측", shortLabel: "내일" };
  }
  // 주말/연휴 넘어 다음 거래일
  const [, mm, dd] = surveyDate.split("-");
  const days = ["일","월","화","수","목","금","토"];
  const d = new Date(surveyDate + "T00:00:00+09:00");
  const dayKor = days[d.getDay()];
  return { isNextDay: true, label: `다음 거래일 예측 (${mm}/${dd} ${dayKor})`, shortLabel: `${mm}/${dd}(${dayKor})` };
}

/** 사전 예측이 적용되는 거래일 표시용 */
function formatPreSurveyTarget(surveyDate: string) {
  const dateKey = surveyDate.trim().slice(0, 10);
  const d = new Date(`${dateKey}T12:00:00+09:00`);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()] ?? "";
  const parts = dateKey.split("-");
  const y = parts[0] ?? "";
  const m = parts[1] ? String(Number(parts[1])) : "";
  const day = parts[2] ? String(Number(parts[2])) : "";
  const dayInfo = getSurveyDayLabel(dateKey);
  return {
    dateKey,
    weekday,
    dateLine: `${y}년 ${m}월 ${day}일 (${weekday})`,
    dateIso: dateKey,
    roleLine: dayInfo.label,
    shortLabel: dayInfo.shortLabel,
  };
}

function PreSurveyTargetBanner({ surveyDate }: { surveyDate: string }) {
  const t = formatPreSurveyTarget(surveyDate);
  return (
    <p className="text-center text-amber-300/90 text-sm font-bold mb-3">
      사전 예측 · {t.dateLine}
    </p>
  );
}

/** 페이지 제목 — 상단 중앙·한 줄 (예: 오늘 예측) */
function SurveyHeadingTitle({ label }: { label: string }) {
  return (
    <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-black text-white leading-[1.15] tracking-tight">
      {label}
    </h1>
  );
}

function SurveyGaugeSubmit({
  gaugeValue,
  onGaugeChange,
  userTokens,
  submitting,
  submitBtnClass,
  submitLabel,
  onSubmit,
}: {
  gaugeValue: number;
  onGaugeChange: (v: number) => void;
  userTokens: number;
  submitting: boolean;
  submitBtnClass: string;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-4 w-full min-w-0 box-border">
      <GaugeBar
        value={gaugeValue}
        onChange={onGaugeChange}
        tokens={userTokens}
        disabled={submitting}
        beginnerTips
      />
      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={submitting || gaugeValue === 0}
        className={`w-full py-5 font-black text-lg rounded-2xl transition-all active:scale-95 ${submitBtnClass}`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            제출 중...
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}

function SurveyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [today, setToday] = useState<TodaySurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [kospiAnswer, setKospiAnswer] = useState<boolean | null>(null);
  const [gaugePosition, setGaugePosition] = useState<number>(10); // -100~+100, 양수=상승
  const [userTokens, setUserTokens] = useState<number>(100);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [previousAnswer, setPreviousAnswer] = useState<boolean | null>(null);

  const [kospiPrice, setKospiPrice] = useState<KospiPrice | null>(null);
  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 다음 거래일 설문 (장마감 후 미리 참여)
  const [nextSurvey, setNextSurvey] = useState<{ survey_date: string; is_open: boolean } | null>(null);
  const [nextKospiAnswer, setNextKospiAnswer] = useState<boolean | null>(true);
  const [nextGaugePosition, setNextGaugePosition] = useState<number>(10);
  const [nextAlreadyAnswered, setNextAlreadyAnswered] = useState(false);
  const [nextPreviousAnswer, setNextPreviousAnswer] = useState<boolean | null>(null);
  const [nextSubmitted, setNextSubmitted] = useState(false);
  const [nextSubmitting, setNextSubmitting] = useState(false);
  const [nextMyResponseLoading, setNextMyResponseLoading] = useState(false);
  /** 상점 소모품 grant 조회용 */
  const [pendingGrantToday, setPendingGrantToday] = useState<string | null>(null);
  const [pendingGrantNext, setPendingGrantNext] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setRevalidating(true);
    try {
      const summary = await getTodaySummary();
      setToday(summary);
      saveSurveyTodaySnapshot(summary);
      setError(null);
      setLoading(false);

      fetch("/api/next-survey", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setNextSurvey(d))
        .catch(() => {});
    } catch {
      setError("설문 정보를 불러오지 못했습니다.");
      setLoading(false);
    } finally {
      setRevalidating(false);
    }
  }, []);

  const fetchKospiPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/public/kospi-price-lite", {
        cache: "no-store",
      });
      if (res.ok) {
        const d = await res.json();
        setKospiPrice({
          price: d.price ?? null,
          change: null,
          change_pct: d.change_pct ?? null,
          is_up: d.is_up ?? null,
          code: "",
        });
      }
    } catch {
      /* 숫자 참고용 — 실패해도 설문 UI는 그대로 */
    }
  }, []);

  // nudge 링크로 접근하면 토스트 표시
  useEffect(() => {
    const from  = searchParams.get("nudge_from");
    const group = searchParams.get("nudge_group");
    if (!from) return;
    const msg = group ? `📣 ${from}님이 [${group}] 독촉 알림을 보냈습니다.` : `📣 ${from}님이 독촉 알림을 보냈습니다.`;
    setNudgeToast(msg);
    const t = setTimeout(() => setNudgeToast(null), 4000);
    return () => clearTimeout(t);
  }, [searchParams]);

  // 확정 등락률이 없고 장 중일 때만 백그라운드 숫자 갱신(60초)
  useEffect(() => {
    if (today?.kospi_change_pct != null) return;
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const mins = kst.getHours() * 60 + kst.getMinutes();
    const isMarketOpen = mins >= 9 * 60 && mins < 15 * 60 + 35;
    if (!isMarketOpen) return;
    void fetchKospiPrice();
    priceTimerRef.current = setInterval(fetchKospiPrice, 60000);
    return () => {
      if (priceTimerRef.current) clearInterval(priceTimerRef.current);
    };
  }, [fetchKospiPrice, today?.kospi_change_pct]);

  const checkMyResponse = useCallback(async (tok: string, surveyDate?: string) => {
    const q = surveyDate ? `?survey_date=${encodeURIComponent(surveyDate)}` : "";
    try {
      const res = await fetch(`/api/survey/my-response${q}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (surveyDate) return Boolean(data.answered);
      if (data.answered) {
        setAlreadyAnswered(true);
        setPreviousAnswer(data.kospi_answer);
        const gp =
          typeof data.gauge_position === "number"
            ? data.gauge_position
            : data.kospi_answer
              ? 50
              : -50;
        setKospiAnswer(data.kospi_answer);
        setGaugePosition(gp);
      } else {
        setAlreadyAnswered(false);
        setPreviousAnswer(null);
        setKospiAnswer(null);
        setGaugePosition(10);
      }
      return Boolean(data.answered);
    } catch {
      return false;
    }
  }, []);

  // 다음 거래일 미리설문 내 응답 조회 — nextSurvey를 의존성에 넣지 않고 분리해야
  // 인증 리스너가 반복 재구독되며 잘못된 순서로 상태가 바뀌지 않도록 함.
  useEffect(() => {
    if (!token || !nextSurvey?.is_open || !nextSurvey.survey_date) {
      setNextMyResponseLoading(false);
      return;
    }
    const surveyDate = nextSurvey.survey_date;
    let cancelled = false;
    setNextMyResponseLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/survey/my-response?survey_date=${encodeURIComponent(surveyDate)}`,
          { cache: "no-store", headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.answered) {
          setNextAlreadyAnswered(true);
          setNextPreviousAnswer(data.kospi_answer);
          setNextKospiAnswer(data.kospi_answer);
          const gp = typeof data.gauge_position === "number" ? data.gauge_position : (data.kospi_answer ? 50 : -50);
          setNextGaugePosition(gp);
        } else {
          setNextAlreadyAnswered(false);
          setNextPreviousAnswer(null);
          setNextSubmitted(false);
          setNextGaugePosition(10);
          setNextKospiAnswer(true);
        }
      } finally {
        if (!cancelled) setNextMyResponseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, nextSurvey?.survey_date, nextSurvey?.is_open]);

  useEffect(() => {
    if (!token || !today?.survey_date) return;
    void checkMyResponse(token, today.survey_date.slice(0, 10));
  }, [token, today?.survey_date, checkMyResponse]);

  useLayoutEffect(() => {
    const s = peekSurveyTodaySnapshot();
    if (s) {
      setToday(s.today);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = (session: { access_token: string; user?: { id: string } }) => {
      if (cancelled) return;
      setToken(session.access_token);
      if (session.user?.id) setUserId(session.user.id);
      void loadToday();
      void (async () => {
        await checkMyResponse(session.access_token);
        const snap = peekDashboardSnapshot();
        if (typeof snap?.dash?.tokens === "number") {
          setUserTokens(snap.dash.tokens);
        }
        try {
          const me = await getMe(session.access_token);
          if (typeof me.tokens === "number") setUserTokens(me.tokens);
        } catch {
          /* 토큰 표시는 기본값 유지 */
        }
      })();
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        clearAllTabSnapshots();
        router.replace("/");
        setLoading(false);
        return;
      }
      bootstrapSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      if (event === "SIGNED_IN" && session) bootstrapSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, loadToday, checkMyResponse]);

  const refreshPendingGrants = useCallback(async () => {
    if (!token) return;
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const sdToday = today?.survey_date ?? todayStr;
    try {
      const r = await fetch(`/api/survey/pending-grant?survey_date=${encodeURIComponent(sdToday)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const d = (await r.json()) as { grant_kind?: string | null };
        setPendingGrantToday(typeof d.grant_kind === "string" ? d.grant_kind : null);
      } else {
        setPendingGrantToday(null);
      }
    } catch {
      setPendingGrantToday(null);
    }
    if (nextSurvey?.survey_date) {
      try {
        const r2 = await fetch(
          `/api/survey/pending-grant?survey_date=${encodeURIComponent(nextSurvey.survey_date)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );
        if (r2.ok) {
          const d2 = (await r2.json()) as { grant_kind?: string | null };
          setPendingGrantNext(typeof d2.grant_kind === "string" ? d2.grant_kind : null);
        } else {
          setPendingGrantNext(null);
        }
      } catch {
        setPendingGrantNext(null);
      }
    } else {
      setPendingGrantNext(null);
    }
  }, [token, today?.survey_date, nextSurvey?.survey_date]);

  useEffect(() => {
    void refreshPendingGrants();
  }, [refreshPendingGrants, today?.status, alreadyAnswered, submitted, nextAlreadyAnswered, nextSubmitted]);

  const handleSubmit = async () => {
    if (!token || kospiAnswer === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
      const surveyDate = today?.survey_date ?? todayStr;
      const res = await fetch(`/api/survey/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kospi_answer: kospiAnswer,
          gauge_position: gaugePosition,
          survey_date: surveyDate,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(formatApiErrorMessage(res.status, text));
      }
      const data = (await res.json().catch(() => ({}))) as {
        current_tokens?: number;
        is_global_top_expert?: boolean;
      };
      if (typeof data.current_tokens === "number") setUserTokens(data.current_tokens);
      if (data.is_global_top_expert) {
        setIsGlobalTopExpert(true);
        const uid = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        if (uid) {
          setUserId(uid);
          markWasTopExpert(uid);
        }
      }
      setSubmitted(true);
      setAlreadyAnswered(true);
      setPreviousAnswer(kospiAnswer);
      const sd = today?.survey_date?.slice(0, 10);
      if (sd) void checkMyResponse(token, sd);
      void refreshPendingGrants();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/failed\s*to\s*fetch|load\s*failed|network\s*error/i.test(raw) || !raw) {
        setError("서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError(raw);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextSubmit = async () => {
    if (!token || nextKospiAnswer === null || !nextSurvey) return;
    setNextSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kospi_answer: nextKospiAnswer, gauge_position: nextGaugePosition, survey_date: nextSurvey.survey_date }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(formatApiErrorMessage(res.status, text));
      }
      const data = (await res.json().catch(() => ({}))) as {
        current_tokens?: number;
        is_global_top_expert?: boolean;
      };
      if (typeof data.current_tokens === "number") setUserTokens(data.current_tokens);
      if (data.is_global_top_expert) {
        setIsGlobalTopExpert(true);
        const uid = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        if (uid) {
          setUserId(uid);
          markWasTopExpert(uid);
        }
      }
      setNextSubmitted(true);
      setNextAlreadyAnswered(true);
      setNextPreviousAnswer(nextKospiAnswer);
      if (nextSurvey.survey_date) {
        const res = await fetch(
          `/api/survey/my-response?survey_date=${encodeURIComponent(nextSurvey.survey_date)}`,
          { cache: "no-store", headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.answered) {
            setNextAlreadyAnswered(true);
            setNextPreviousAnswer(data.kospi_answer);
            const gp =
              typeof data.gauge_position === "number"
                ? data.gauge_position
                : data.kospi_answer
                  ? 50
                  : -50;
            setNextGaugePosition(gp);
          }
        }
      }
      void refreshPendingGrants();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setNextSubmitting(false);
    }
  };

  if (loading && !today) {
    return <PageLoadProgress label="설문 정보 불러오는 중…" accent="violet" />;
  }

  const status = today?.status ?? "no_survey";

  // API status와 무관하게 클라이언트에서 주말 여부 직접 판단
  const _kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const _kstDay = _kstNow.getDay();
  const isWeekendKST = _kstDay === 0 || _kstDay === 6;
  /** 당일 설문 제출 전에는 사전설문 UI를 가리고, 마감·결과·휴장·당일 완료 후에만 표시 */
  const showNextPreSurvey =
    !!nextSurvey?.is_open && (status !== "open" || alreadyAnswered || submitted);

  return (
    <main className="relative w-full min-h-screen app-page-tab-pad min-w-0 box-border text-[1.0625rem] sm:text-lg px-4 sm:px-5">
      <StaleRefreshIndicator show={revalidating && !!today} tone="violet" />
      <AppAmbientBackground />
      <div className="relative z-10">
      {/* 독촉 토스트 */}
      {nudgeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-4 bg-orange-500 text-white text-base font-bold rounded-2xl shadow-xl animate-bounce-in max-w-sm text-center">
          {nudgeToast}
        </div>
      )}

      {/* 휴장일 배지 — 주말이면 status 무관하게 표시 */}
      {isWeekendKST && (() => {
        const mm = String(_kstNow.getMonth() + 1).padStart(2, "0");
        const dd = String(_kstNow.getDate()).padStart(2, "0");
        const dayNames = ["일","월","화","수","목","금","토"];
        return (
          <div className="pt-6 pb-1 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 border border-gray-700 text-base text-gray-400">
              <span>🏖️</span>
              <span>{mm}/{dd}({dayNames[_kstDay]}) 오늘은 휴장일입니다</span>
            </div>
          </div>
        );
      })()}

      <div className="pt-5 pb-7 w-full text-center px-2">
        {(() => {
          if (isWeekendKST) {
            const next = new Date(_kstNow);
            next.setDate(next.getDate() + 1);
            next.setHours(0, 0, 0, 0);
            while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
            const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
            const mm = String(next.getMonth() + 1).padStart(2, "0");
            const dd = String(next.getDate()).padStart(2, "0");
            const nextDateStr = `${next.getFullYear()}.${mm}.${dd}`;
            return (
              <>
                <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-black text-white leading-[1.15] tracking-tight">
                  {dayNames[next.getDay()]}요일 예측
                </h1>
                <p className="text-base sm:text-lg text-gray-500 mt-2 tabular-nums">{nextDateStr} (KST)</p>
              </>
            );
          }
          const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
          const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
          const surveyDate = today?.survey_date ?? todayStr;
          const { label } = getSurveyDayLabel(surveyDate);
          const displayDate = surveyDate.replace(/-/g, ".");
          return (
            <>
              <SurveyHeadingTitle label={label} />
              <p className="text-base sm:text-lg text-gray-500 mt-2 tabular-nums">{displayDate} (KST)</p>
            </>
          );
        })()}
      </div>

      {!isWeekendKST && status !== "no_survey" ? (
        <KospiPriceStrip
          status={status}
          resultPct={today?.kospi_change_pct ?? null}
          resultUp={today?.kospi_result ?? null}
          live={kospiPrice}
        />
      ) : null}

      {/* 설문 없음 — 대기중 vs 휴장일 구분 */}
      {/* 주말·no_survey 상태에서 다음 거래일 예측 섹션 */}
      {(status === "no_survey" || isWeekendKST) && showNextPreSurvey && nextSurvey?.survey_date && (
        <div className="mt-4 space-y-4">
          <div className="border-t border-[#2A2A2A] pt-5">
            <PreSurveyTargetBanner surveyDate={nextSurvey.survey_date} />
            {nextMyResponseLoading ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-8 h-8 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-base text-gray-500">사전 참여 여부 확인 중…</p>
              </div>
            ) : nextSubmitted || nextAlreadyAnswered ? (
              pendingGrantNext === "redo_full" ? (
                <>
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center">
                    <p className="text-amber-300 text-base font-bold leading-snug">재투표 1회: 게이지를 재설정한 뒤 제출합니다</p>
                  </div>
                  <SurveyGaugeSubmit
                    gaugeValue={nextGaugePosition}
                    onGaugeChange={(v) => {
                      setNextGaugePosition(v);
                      setNextKospiAnswer(v > 0);
                    }}
                    userTokens={userTokens}
                    submitting={nextSubmitting}
                    submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                    submitLabel="재투표 제출하기"
                    onSubmit={handleNextSubmit}
                  />
                  {error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
                      {error}
                    </div>
                  ) : null}
                </>
              ) : (
              <div className="flex flex-col gap-3 w-full items-stretch">
                <p className="text-center text-base text-emerald-400 font-bold mb-1">
                  {formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 거래일 사전 예측 제출 완료
                </p>
                <div className="w-full min-w-0 space-y-1">
                  <GaugeBar
                    value={nextGaugePosition}
                    onChange={() => {}}
                    tokens={userTokens}
                    disabled
                    beginnerTips
                  />
                </div>
              </div>
              )
            ) : (
              <>
                  <SurveyGaugeSubmit
                    gaugeValue={nextGaugePosition}
                  onGaugeChange={(v) => { setNextGaugePosition(v); setNextKospiAnswer(v > 0); }}
                  userTokens={userTokens}
                  submitting={nextSubmitting}
                    submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                  submitLabel={`${formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 사전 예측 제출`}
                  onSubmit={handleNextSubmit}
                />
              </>
            )}
          </div>
        </div>
      )}

      {status === "no_survey" && (() => {
        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const day = kst.getDay();
        const mins = kst.getHours() * 60 + kst.getMinutes();
        const isWeekend = day === 0 || day === 6;
        // 09:00~22:00 사이만 "설문 시작 전" (그 외 시간은 전날 22:00에 이미 열림)
        const isPreSurvey = !isWeekend && mins >= 9 * 60 && mins < 22 * 60;
        // 00:00~09:00 사이인데 no_survey → 설문 레코드가 아직 없는 경우
        const isEarlyMorning = !isWeekend && mins < 9 * 60;
        return (
          <div className="flex flex-col gap-5 mt-10">
            <div className="flex flex-col items-center gap-3 text-center">
              {isEarlyMorning ? (
                <>
                  <div className="text-5xl">⏳</div>
                  <p className="text-2xl sm:text-3xl font-bold text-white leading-snug">설문 준비 중입니다</p>
                  <p className="text-base text-gray-400 px-2">
                    잠시 후 화면을 새로 고침해 주십시오.
                  </p>
                </>
              ) : isPreSurvey ? (
                <>
                  <div className="text-5xl">⏳</div>
                  <p className="text-2xl sm:text-3xl font-bold text-white leading-snug">설문 시작 전입니다</p>
                  <p className="text-base text-gray-400 px-2">
                    당일 22:00에 차기 거래일 설문이 시작됩니다.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl">🏖️</div>
                  <p className="text-2xl sm:text-3xl font-bold text-white leading-snug">당일은 개장하지 않습니다</p>
                  <p className="text-base text-gray-400 px-2">주말·공휴일에는 거래소가 개장하지 않습니다.</p>
                  {nextSurvey?.is_open && (
                    <p className="text-base text-yellow-400 mt-2 px-2">
                      💡 {formatPreSurveyTarget(nextSurvey.survey_date).dateLine} 사전 예측 가능
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 설문 진행 중 — 이미 제출함 */}
      {status === "open" && !isWeekendKST && alreadyAnswered && !submitted && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          <p className="text-center text-emerald-400 font-bold">오늘 예측 제출 완료 · 09:00 마감</p>
          {pendingGrantToday === "redo_full" ? (
            <>
              <p className="text-center text-sm text-emerald-300">재투표 1회 가능</p>
              <SurveyGaugeSubmit
                gaugeValue={gaugePosition}
                onGaugeChange={(v) => {
                  setGaugePosition(v);
                  setKospiAnswer(v > 0);
                }}
                userTokens={userTokens}
                submitting={submitting}
                                    submitBtnClass="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
                submitLabel="재투표 제출하기"
                onSubmit={handleSubmit}
              />
              {error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
                  {error}
                </div>
              ) : null}
            </>
          ) : (
            <GaugeBar
              value={gaugePosition}
              onChange={() => {}}
              tokens={userTokens}
              disabled
              beginnerTips
            />
          )}
          {showNextPreSurvey && nextSurvey?.survey_date && (
            <div className="mt-4 space-y-4 border-t border-[#2A2A2A] pt-5">
              <PreSurveyTargetBanner surveyDate={nextSurvey.survey_date} />
              {nextMyResponseLoading ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                  <p className="text-base text-gray-500">사전 참여 여부 확인 중…</p>
                </div>
              ) : nextSubmitted || nextAlreadyAnswered ? (
                <div className="flex flex-col gap-3 w-full items-stretch">
                  <p className="text-center text-base text-emerald-400 font-bold">
                    {formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 거래일 사전 예측 제출 완료
                  </p>
                  <GaugeBar value={nextGaugePosition} onChange={() => {}} tokens={userTokens} disabled beginnerTips />
                </div>
              ) : (
                <>
                  <SurveyGaugeSubmit
                    gaugeValue={nextGaugePosition}
                    onGaugeChange={(v) => { setNextGaugePosition(v); setNextKospiAnswer(v > 0); }}
                    userTokens={userTokens}
                    submitting={nextSubmitting}
                    submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                    submitLabel={`${formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 사전 예측 제출`}
                    onSubmit={handleNextSubmit}
                  />
                  {error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
                      {error}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 설문 진행 중 — 투표 폼 */}
      {status === "open" && !isWeekendKST && !alreadyAnswered && !submitted && (
        <div className="space-y-4 mt-4 fade-up">
          <p className="text-center text-sm text-gray-400">09:00 마감 · 게이지로 방향·확신도 선택</p>
          <div className="w-full min-w-0">
            <SurveyGaugeSubmit
              gaugeValue={gaugePosition}
              onGaugeChange={(v) => { setGaugePosition(v); setKospiAnswer(v > 0); }}
              userTokens={userTokens}
              submitting={submitting}
              submitBtnClass="bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
              submitLabel="예측 제출하기"
              onSubmit={handleSubmit}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {status === "open" && !isWeekendKST && submitted && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          <p className="text-center text-emerald-400 font-bold">제출 완료</p>
          {pendingGrantToday === "redo_full" ? (
            <SurveyGaugeSubmit
              gaugeValue={gaugePosition}
              onGaugeChange={(v) => {
                setGaugePosition(v);
                setKospiAnswer(v > 0);
              }}
              userTokens={userTokens}
              submitting={submitting}
                                  submitBtnClass="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
              submitLabel="재투표 제출하기"
              onSubmit={handleSubmit}
            />
          ) : (
            <GaugeBar
              value={gaugePosition}
              onChange={() => {}}
              tokens={userTokens}
              disabled
              beginnerTips
            />
          )}
          <Link
            href="/team-chat"
            className="block rounded-2xl border border-violet-500/35 bg-violet-500/10 px-4 py-3.5 text-center text-sm font-bold text-violet-200 hover:bg-violet-500/15"
          >
            소통방 보기 →
          </Link>
        </div>
      )}

      {(status === "closed" || status === "result") && !isWeekendKST && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          {!alreadyAnswered && previousAnswer === null && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-center space-y-2">
              <p className="text-amber-200 font-bold text-base">이 거래일 설문에 참여하지 않았습니다</p>
              <p className="text-sm text-gray-400 leading-snug">
                09:00 마감 전에 제출했거나, 전날 사전 예측으로 미리 넣었어야 합니다.
              </p>
            </div>
          )}
          {(previousAnswer !== null || alreadyAnswered) && (
            <div className="space-y-2">
              <GaugeBar
                value={gaugePosition}
                onChange={() => {}}
                tokens={userTokens}
                disabled
                beginnerTips
              />
              {status === "result" && today?.kospi_result != null ? (
                <p
                  className={`text-center text-xl font-black ${
                    (previousAnswer ?? kospiAnswer) === today.kospi_result
                      ? "text-green-400"
                      : "text-red-400/95"
                  }`}
                >
                  {(previousAnswer ?? kospiAnswer) === today.kospi_result
                    ? "적중"
                    : "미적중"}
                </p>
              ) : (
                <p className="text-center text-sm text-gray-500">15:35 결과 공개 예정</p>
              )}
            </div>
          )}

          {/* 다음 거래일 사전 예측 */}
          {showNextPreSurvey && nextSurvey?.survey_date && (
            <div className="mt-2 space-y-4">
              <div className="border-t border-[#2A2A2A] pt-5">
                <PreSurveyTargetBanner surveyDate={nextSurvey.survey_date} />
                {nextMyResponseLoading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                    <p className="text-base text-gray-500">사전 참여 여부 확인 중…</p>
                  </div>
                ) : nextSubmitted || nextAlreadyAnswered ? (
                  pendingGrantNext === "redo_full" ? (
                    <>
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center">
                        <p className="text-amber-300 text-base font-bold leading-snug">재투표 1회: 게이지를 재설정한 뒤 제출합니다</p>
                      </div>
                  <SurveyGaugeSubmit
                    gaugeValue={nextGaugePosition}
                        onGaugeChange={(v) => {
                          setNextGaugePosition(v);
                          setNextKospiAnswer(v > 0);
                        }}
                        userTokens={userTokens}
                        submitting={nextSubmitting}
                        submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                        submitLabel="재투표 제출하기"
                        onSubmit={handleNextSubmit}
                      />
                      {error ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center mt-2">
                          {error}
                        </div>
                      ) : null}
                    </>
                  ) : (
                  <div className="flex flex-col gap-3 w-full items-stretch">
                    <p className="text-center text-base text-emerald-400 font-bold mb-1">
                      {formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 거래일 사전 예측 제출 완료
                    </p>
                    <div className="w-full min-w-0 space-y-1">
                      <GaugeBar
                        value={nextGaugePosition}
                        onChange={() => {}}
                        tokens={userTokens}
                        disabled
                        beginnerTips
                      />
                    </div>
                  </div>
                  )
                ) : (
                  <>
                  <SurveyGaugeSubmit
                    gaugeValue={nextGaugePosition}
                      onGaugeChange={(v) => { setNextGaugePosition(v); setNextKospiAnswer(v > 0); }}
                      userTokens={userTokens}
                      submitting={nextSubmitting}
                      submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                      submitLabel={`${formatPreSurveyTarget(nextSurvey.survey_date).dateIso} 사전 예측 제출`}
                      onSubmit={handleNextSubmit}
                    />
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center mt-2">
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      </div>

      <AppTabNav />
    </main>
  );
}

export default function SurveyPage() {
  return (
    <Suspense>
      <SurveyPageInner />
    </Suspense>
  );
}
