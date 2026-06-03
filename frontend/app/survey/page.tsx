"use client";

import { useEffect, useState, useCallback, useRef, Suspense, useLayoutEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { MySurveyResponse, TodaySurvey } from "@/lib/api";
import { buildKstSurveyTodayPlaceholder } from "@/lib/survey-today-placeholder";
import {
  fetchNextSurveyCached,
  getMeCached,
  getMySurveyResponseCached,
  getPendingGrantCached,
  getTodaySummaryCached,
  invalidateMySurveyResponseCache,
  invalidatePendingGrantCache,
  invalidateTodaySummaryCache,
} from "@/lib/session-api-cache";
import {
  clearAllTabSnapshots,
  peekAnsweredToday,
  peekDashboardSnapshot,
  peekSurveyNextSnapshot,
  peekSurveyTodaySnapshot,
  saveAnsweredToday,
  saveSurveyNextSnapshot,
  saveSurveyTodaySnapshot,
} from "@/lib/tab-session-cache";
import { markWasTopExpert } from "@/lib/top-expert-notice";
import { formatApiErrorMessage } from "@/lib/format-api-error";
import GaugeBar from "@/components/GaugeBar";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import PageLoadProgress from "@/components/PageLoadProgress";
import AppTabNav from "@/components/AppTabNav";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";
import WeeklyParticipationCard from "@/components/WeeklyParticipationCard";
import CrowdGaugeBoxplotsSection from "@/components/CrowdGaugeBoxplotsSection";
import { isKospiMarketSessionOpenKST } from "@/lib/kospi-market-hours";
import { surveyUi } from "@/lib/survey-ui-tokens";

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

/** 페이지 제목 — 상단 중앙·한 줄 (예: 오늘 예측) */
function SurveyHeadingTitle({ label }: { label: string }) {
  return (
    <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-black text-white leading-[1.15] tracking-tight">
      {label}
    </h1>
  );
}

/** 제출 완료 후 요약 · 확신도 변경 진입 */
function SurveyCompletedPanel({
  headline,
  subline,
  gaugeValue,
  userTokens,
  editing,
  onStartEdit,
  onCancelEdit,
  justSaved,
  pendingGrantRedo,
  submitting,
  submitDisabled,
  onSubmit,
  onGaugeChange,
  error,
  showTeamChatLink = false,
  submitBtnClass = "bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-gray-500 text-white",
  completedLabel = "설문 완료",
}: {
  headline: string;
  subline?: string;
  completedLabel?: string;
  gaugeValue: number;
  userTokens: number;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  justSaved: boolean;
  pendingGrantRedo: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void | Promise<void>;
  onGaugeChange: (v: number) => void;
  error: string | null;
  showTeamChatLink?: boolean;
  submitBtnClass?: string;
}) {
  if (pendingGrantRedo) {
    return (
      <>
        <p className={`text-center ${surveyUi.body} text-amber-300 mb-2`}>재투표 1회 가능</p>
        <SurveyGaugeSubmit
          gaugeValue={gaugeValue}
          onGaugeChange={onGaugeChange}
          userTokens={userTokens}
          submitting={submitting}
          submitDisabled={submitDisabled}
          submitBtnClass="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
          submitLabel="재투표 제출하기"
          onSubmit={onSubmit}
        />
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
            {error}
          </div>
        ) : null}
      </>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        {headline ? (
          <p className={`text-center ${surveyUi.cardTitle} text-emerald-400`}>{headline}</p>
        ) : null}
        {justSaved ? (
          <div
            className={`rounded-xl border border-emerald-500/45 bg-emerald-500/20 px-4 py-3 text-center ${surveyUi.body} text-emerald-200`}
            role="status"
          >
            ✓ 확신도가 저장되었어요
          </div>
        ) : null}
        <div className="space-y-3">
          <GaugeBar
            value={gaugeValue}
            onChange={() => {}}
            tokens={userTokens}
            disabled
            beginnerTips={false}
            surveyCompleted
            completedLabel={completedLabel}
          />
        </div>
        <button
          type="button"
          onClick={onStartEdit}
          disabled={submitDisabled}
          className={surveyUi.btnSecondary}
        >
          확신도 변경하기
        </button>
        {showTeamChatLink ? (
          <Link
            href="/team-chat"
            className={`block rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 text-center ${surveyUi.btnPrimary} text-violet-200 hover:bg-violet-500/15`}
          >
            소통방 보기 →
          </Link>
        ) : null}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={`text-center ${surveyUi.cardTitle} text-amber-200/95`}>확신도 조정 중</p>
      <p className={`text-center ${surveyUi.cardMeta}`}>방향 유지 · 09:00 마감 전에 저장해 주세요</p>
      <SurveyGaugeSubmit
        gaugeValue={gaugeValue}
        onGaugeChange={onGaugeChange}
        userTokens={userTokens}
        submitting={submitting}
        submitDisabled={submitDisabled}
        lockDirection
        submitBtnClass={submitBtnClass}
        submitLabel="확신도 저장"
        onSubmit={onSubmit}
      />
      <button
        type="button"
        onClick={onCancelEdit}
        disabled={submitting}
        className={`${surveyUi.btnSecondary} border-[#333] bg-[#1A1A1A] text-gray-400 hover:text-white`}
      >
        취소
      </button>
      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center">
          {error}
        </div>
      ) : null}
    </div>
  );
}

/** 사전 예측 — 참여 여부 확인 중에도 게이지를 바로 보여 줌 */
function NextPreSurveyPanel({
  surveyDate,
  responseKnown,
  submitted,
  alreadyAnswered,
  pendingGrantRedo,
  gaugeValue,
  onGaugeChange,
  userTokens,
  submitting,
  onSubmit,
  error,
  submitDisabled = false,
  editingConfidence,
  onStartEditConfidence,
  onCancelEditConfidence,
  confidenceJustSaved,
}: {
  surveyDate: string;
  responseKnown: boolean;
  submitted: boolean;
  alreadyAnswered: boolean;
  pendingGrantRedo: boolean;
  gaugeValue: number;
  onGaugeChange: (v: number) => void;
  userTokens: number;
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
  error: string | null;
  submitDisabled?: boolean;
  editingConfidence: boolean;
  onStartEditConfidence: () => void;
  onCancelEditConfidence: () => void;
  confidenceJustSaved: boolean;
}) {
  const target = formatPreSurveyTarget(surveyDate);
  if (submitted || alreadyAnswered) {
    return (
      <>
        <SurveyCompletedPanel
          headline=""
          completedLabel="사전 예측 완료"
          gaugeValue={gaugeValue}
          userTokens={userTokens}
          editing={editingConfidence}
          onStartEdit={onStartEditConfidence}
          onCancelEdit={onCancelEditConfidence}
          justSaved={confidenceJustSaved}
          pendingGrantRedo={pendingGrantRedo}
          submitting={submitting}
          submitDisabled={submitDisabled}
          onSubmit={onSubmit}
          onGaugeChange={onGaugeChange}
          error={error}
          submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
        />
      </>
    );
  }

  return (
    <>
      {!responseKnown ? (
        <p className={`text-center ${surveyUi.hint} mb-2`}>참여 여부 확인 중… (아래에서 바로 넣을 수 있어요)</p>
      ) : null}
      <SurveyGaugeSubmit
        gaugeValue={gaugeValue}
        onGaugeChange={onGaugeChange}
        userTokens={userTokens}
        submitting={submitting || !responseKnown}
        submitDisabled={submitDisabled}
        submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
        submitLabel={`${target.dateIso} 사전 예측 제출`}
        onSubmit={onSubmit}
      />
      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-base text-center mt-2">
          {error}
        </div>
      ) : null}
    </>
  );
}

function SurveyGaugeSubmit({
  gaugeValue,
  onGaugeChange,
  userTokens,
  submitting,
  submitDisabled = false,
  submitBtnClass,
  submitLabel,
  onSubmit,
  lockDirection = false,
}: {
  gaugeValue: number;
  onGaugeChange: (v: number) => void;
  userTokens: number;
  submitting: boolean;
  submitDisabled?: boolean;
  submitBtnClass: string;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
  lockDirection?: boolean;
}) {
  const locked = submitting || submitDisabled;
  return (
    <div className="space-y-4 w-full min-w-0 box-border">
      <GaugeBar
        value={gaugeValue}
        onChange={onGaugeChange}
        tokens={userTokens}
        disabled={locked}
        lockDirection={lockDirection}
        beginnerTips
      />
      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={locked || gaugeValue === 0}
        className={`${surveyUi.btnPrimary} ${submitBtnClass}`}
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
  const [authChecking, setAuthChecking] = useState(true);
  /** true면 서버 today/summary 미수신 — 제출만 잠금 */
  const [awaitingToday, setAwaitingToday] = useState(true);
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
  const [nextMyResponseKnown, setNextMyResponseKnown] = useState(false);
  /** 상점 소모품 grant 조회용 */
  const [pendingGrantToday, setPendingGrantToday] = useState<string | null>(null);
  const [pendingGrantNext, setPendingGrantNext] = useState<string | null>(null);
  const [editingTodayConfidence, setEditingTodayConfidence] = useState(false);
  const [editingNextConfidence, setEditingNextConfidence] = useState(false);
  const [confidenceSavedFlash, setConfidenceSavedFlash] = useState(false);
  const [nextConfidenceSavedFlash, setNextConfidenceSavedFlash] = useState(false);
  const confidenceFlashTimerRef = useRef<number | null>(null);
  const nextConfidenceFlashTimerRef = useRef<number | null>(null);

  const applyNextSurvey = useCallback(
    (d: { survey_date: string; is_open: boolean } | null | undefined) => {
      if (d?.survey_date) {
        setNextSurvey(d);
        saveSurveyNextSnapshot(d);
      }
    },
    [],
  );

  const loadToday = useCallback(async () => {
    setRevalidating(true);
    try {
      const summary = await getTodaySummaryCached();
      const nextFallback =
        summary.next_survey?.survey_date != null
          ? summary.next_survey
          : await fetchNextSurveyCached();
      setToday(summary);
      saveSurveyTodaySnapshot(summary);
      applyNextSurvey(nextFallback);
      setError(null);
      setAwaitingToday(false);
    } catch {
      setError("설문 정보를 불러오지 못했습니다.");
    } finally {
      setRevalidating(false);
    }
  }, [applyNextSurvey]);

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

  // 확정 등락률 전 — 정규장(09:00~15:35)에만 시세 조회·갱신
  useEffect(() => {
    if (today?.kospi_change_pct != null) return;
    if (!isKospiMarketSessionOpenKST()) {
      setKospiPrice(null);
      return;
    }
    void fetchKospiPrice();
    priceTimerRef.current = setInterval(fetchKospiPrice, 60000);
    return () => {
      if (priceTimerRef.current) clearInterval(priceTimerRef.current);
    };
  }, [fetchKospiPrice, today?.kospi_change_pct]);

  const applyTodayResponse = useCallback((data: MySurveyResponse) => {
    if (data.answered) {
      setAlreadyAnswered(true);
      setSubmitted(true);
      setEditingTodayConfidence(false);
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
      setSubmitted(false);
      setEditingTodayConfidence(false);
      setPreviousAnswer(null);
      setKospiAnswer(null);
      setGaugePosition(10);
    }
  }, []);

  const applyNextResponse = useCallback((data: MySurveyResponse) => {
    if (data.answered) {
      setNextAlreadyAnswered(true);
      setNextSubmitted(true);
      setEditingNextConfidence(false);
      setNextPreviousAnswer(data.kospi_answer);
      setNextKospiAnswer(data.kospi_answer);
      const gp =
        typeof data.gauge_position === "number"
          ? data.gauge_position
          : data.kospi_answer
            ? 50
            : -50;
      setNextGaugePosition(gp);
    } else {
      setNextAlreadyAnswered(false);
      setNextPreviousAnswer(null);
      setNextSubmitted(false);
      setEditingNextConfidence(false);
      setNextGaugePosition(10);
      setNextKospiAnswer(true);
    }
  }, []);

  const checkMyResponse = useCallback(async (tok: string, surveyDate: string) => {
    const sd = surveyDate.slice(0, 10);
    try {
      const data = await getMySurveyResponseCached(tok, sd);
      saveAnsweredToday(sd, Boolean(data.answered));
      applyTodayResponse(data);
      return Boolean(data.answered);
    } catch {
      return false;
    }
  }, [applyTodayResponse]);

  const loadNextMyResponse = useCallback(
    async (tok: string, surveyDate: string) => {
      setNextMyResponseKnown(false);
      try {
        const data = await getMySurveyResponseCached(tok, surveyDate.slice(0, 10));
        applyNextResponse(data);
      } catch {
        /* 사전 예측 UI는 기본값 유지 */
      } finally {
        setNextMyResponseKnown(true);
      }
    },
    [applyNextResponse],
  );

  useEffect(() => {
    if (!token || !nextSurvey?.is_open || !nextSurvey.survey_date) {
      setNextMyResponseKnown(false);
      return;
    }
    let cancelled = false;
    const surveyDate = nextSurvey.survey_date;
    const id = window.setTimeout(() => {
      void loadNextMyResponse(token, surveyDate).then(() => {
        if (cancelled) setNextMyResponseKnown(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [token, nextSurvey?.survey_date, nextSurvey?.is_open, loadNextMyResponse]);

  useEffect(() => {
    if (!token || !today?.survey_date) return;
    const sd = today.survey_date.slice(0, 10);
    const answeredCache = peekAnsweredToday(sd);
    if (answeredCache === true) {
      setAlreadyAnswered(true);
      setSubmitted(true);
    } else if (answeredCache === false) setAlreadyAnswered(false);
    void checkMyResponse(token, sd);
  }, [token, today?.survey_date, checkMyResponse]);

  useLayoutEffect(() => {
    const s = peekSurveyTodaySnapshot();
    const dash = peekDashboardSnapshot();
    const fromServer = s?.today ?? dash?.today ?? null;
    setToday(fromServer ?? buildKstSurveyTodayPlaceholder());
    setAwaitingToday(!fromServer);
    if (fromServer?.next_survey?.survey_date) {
      setNextSurvey(fromServer.next_survey);
      saveSurveyNextSnapshot(fromServer.next_survey);
    }
    const n = peekSurveyNextSnapshot();
    if (n?.survey_date) setNextSurvey(n);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = (session: { access_token: string; user?: { id: string } }) => {
      if (cancelled) return;
      setToken(session.access_token);
      if (session.user?.id) setUserId(session.user.id);
      void loadToday();
      void (async () => {
        const snap = peekDashboardSnapshot();
        if (typeof snap?.dash?.tokens === "number") {
          setUserTokens(snap.dash.tokens);
        }
        try {
          const me = await getMeCached(session.access_token);
          if (typeof me.tokens === "number") setUserTokens(me.tokens);
        } catch {
          /* 칩 표시는 기본값 유지 */
        }
      })();
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setAuthChecking(false);
      if (!session) {
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      bootstrapSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        setAuthChecking(false);
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      if (event === "SIGNED_IN" && session) {
        setAuthChecking(false);
        bootstrapSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, loadToday]);

  const refreshPendingGrants = useCallback(async () => {
    if (!token) return;
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const sdToday = today?.survey_date ?? todayStr;
    try {
      setPendingGrantToday(await getPendingGrantCached(token, sdToday));
    } catch {
      setPendingGrantToday(null);
    }
    if (nextSurvey?.survey_date) {
      try {
        setPendingGrantNext(await getPendingGrantCached(token, nextSurvey.survey_date));
      } catch {
        setPendingGrantNext(null);
      }
    } else {
      setPendingGrantNext(null);
    }
  }, [token, today?.survey_date, nextSurvey?.survey_date]);

  useEffect(() => {
    return () => {
      if (confidenceFlashTimerRef.current) clearTimeout(confidenceFlashTimerRef.current);
      if (nextConfidenceFlashTimerRef.current) clearTimeout(nextConfidenceFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token || awaitingToday) return;
    const id = window.setTimeout(() => void refreshPendingGrants(), 80);
    return () => window.clearTimeout(id);
  }, [
    refreshPendingGrants,
    token,
    awaitingToday,
    today?.status,
    alreadyAnswered,
    submitted,
    nextAlreadyAnswered,
    nextSubmitted,
  ]);

  const handleSubmit = async () => {
    if (!token || kospiAnswer === null) return;
    const wasAlreadyAnswered = alreadyAnswered;
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
        const uid = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        if (uid) {
          setUserId(uid);
          markWasTopExpert(uid);
        }
      }
      setAlreadyAnswered(true);
      setPreviousAnswer(kospiAnswer);
      setSubmitted(true);
      setEditingTodayConfidence(false);
      if (wasAlreadyAnswered) {
        setConfidenceSavedFlash(true);
        if (confidenceFlashTimerRef.current) clearTimeout(confidenceFlashTimerRef.current);
        confidenceFlashTimerRef.current = window.setTimeout(() => {
          setConfidenceSavedFlash(false);
          confidenceFlashTimerRef.current = null;
        }, 3500);
      }
      const sd = today?.survey_date?.slice(0, 10);
      if (sd) {
        saveAnsweredToday(sd, true);
        invalidateMySurveyResponseCache();
        invalidateTodaySummaryCache();
        void checkMyResponse(token, sd);
      }
      invalidatePendingGrantCache();
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
    const wasNextAnswered = nextAlreadyAnswered;
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
        const uid = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        if (uid) {
          setUserId(uid);
          markWasTopExpert(uid);
        }
      }
      setNextAlreadyAnswered(true);
      setNextPreviousAnswer(nextKospiAnswer);
      setNextSubmitted(true);
      setEditingNextConfidence(false);
      if (wasNextAnswered) {
        setNextConfidenceSavedFlash(true);
        if (nextConfidenceFlashTimerRef.current) clearTimeout(nextConfidenceFlashTimerRef.current);
        nextConfidenceFlashTimerRef.current = window.setTimeout(() => {
          setNextConfidenceSavedFlash(false);
          nextConfidenceFlashTimerRef.current = null;
        }, 3500);
      }
      if (nextSurvey.survey_date) {
        invalidateMySurveyResponseCache();
        const nextData = await getMySurveyResponseCached(token, nextSurvey.survey_date);
        applyNextResponse(nextData);
      }
      invalidatePendingGrantCache();
      void refreshPendingGrants();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setNextSubmitting(false);
    }
  };

  const crowdOpenDates = useMemo(() => {
    const out: string[] = [];
    const todayKey = today?.survey_date?.trim().slice(0, 10);
    if (
      todayKey &&
      todayKey.length >= 8 &&
      today?.status !== "no_survey" &&
      today?.status !== "result"
    ) {
      out.push(todayKey);
    }
    const nextKey = nextSurvey?.survey_date?.trim().slice(0, 10);
    if (nextSurvey?.is_open && nextKey && nextKey.length >= 8 && !out.includes(nextKey)) {
      out.push(nextKey);
    }
    return out;
  }, [today?.survey_date, today?.status, nextSurvey?.survey_date, nextSurvey?.is_open]);

  if (authChecking) {
    return <PageLoadProgress label="확인 중…" accent="violet" />;
  }

  const status = today?.status ?? "no_survey";
  const surveyUiLocked = awaitingToday || submitting || nextSubmitting;

  // API status와 무관하게 클라이언트에서 주말 여부 직접 판단
  const _kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const _kstDay = _kstNow.getDay();
  const isWeekendKST = _kstDay === 0 || _kstDay === 6;
  /** 당일 설문 제출 전에는 사전설문 UI를 가리고, 마감·결과·휴장·당일 완료 후에만 표시 */
  const showNextPreSurvey =
    !!nextSurvey?.is_open && (status !== "open" || alreadyAnswered || submitted);

  return (
    <main className="relative w-full min-h-screen app-page-tab-pad min-w-0 box-border text-[1.0625rem] sm:text-lg px-4 sm:px-5">
      <StaleRefreshIndicator show={(awaitingToday || revalidating) && !!today} tone="violet" />
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

      {!isWeekendKST ? (
        <div className="mb-4 fade-up-2">
          <CrowdGaugeBoxplotsSection
            variant="survey"
            openDates={crowdOpenDates}
            liveKospi={
              isKospiMarketSessionOpenKST() && kospiPrice
                ? {
                    price: kospiPrice.price,
                    change_pct: kospiPrice.change_pct,
                    is_up: kospiPrice.is_up,
                  }
                : null
            }
          />
        </div>
      ) : null}

      {/* 설문 없음 — 대기중 vs 휴장일 구분 */}
      {/* 주말·no_survey 상태에서 다음 거래일 예측 섹션 */}
      {(status === "no_survey" || isWeekendKST) && showNextPreSurvey && nextSurvey?.survey_date && (
        <div className="mt-4 space-y-4">
          <div className="border-t border-[#2A2A2A] pt-5">
            <NextPreSurveyPanel
              surveyDate={nextSurvey.survey_date}
              responseKnown={nextMyResponseKnown}
              submitted={nextSubmitted}
              alreadyAnswered={nextAlreadyAnswered}
              pendingGrantRedo={pendingGrantNext === "redo_full"}
              gaugeValue={nextGaugePosition}
              onGaugeChange={(v) => {
                setNextGaugePosition(v);
                setNextKospiAnswer(v > 0);
              }}
              userTokens={userTokens}
              submitting={nextSubmitting}
              onSubmit={handleNextSubmit}
              error={error}
              submitDisabled={surveyUiLocked}
              editingConfidence={editingNextConfidence}
              onStartEditConfidence={() => {
                setEditingNextConfidence(true);
                setNextConfidenceSavedFlash(false);
              }}
              onCancelEditConfidence={() => {
                setEditingNextConfidence(false);
                if (token && nextSurvey.survey_date) {
                  void loadNextMyResponse(token, nextSurvey.survey_date);
                }
              }}
              confidenceJustSaved={nextConfidenceSavedFlash}
            />
          </div>
        </div>
      )}

      {status === "no_survey" && (() => {
        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const day = kst.getDay();
        const mins = kst.getHours() * 60 + kst.getMinutes();
        const isWeekend = day === 0 || day === 6;
        const isEarlyMorning = !isWeekend && mins < 9 * 60;
        if (!isEarlyMorning) return null;
        return (
          <div className="flex flex-col gap-5 mt-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-5xl">⏳</div>
              <p className="text-2xl sm:text-3xl font-bold text-white leading-snug">설문 준비 중입니다</p>
              <p className="text-base text-gray-400 px-2">잠시 후 화면을 새로 고침해 주십시오.</p>
            </div>
          </div>
        );
      })()}

      {/* 설문 진행 중 — 제출 완료(요약 · 확신도 변경) */}
      {status === "open" && !isWeekendKST && alreadyAnswered && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          <SurveyCompletedPanel
            headline=""
            gaugeValue={gaugePosition}
            userTokens={userTokens}
            editing={editingTodayConfidence}
            onStartEdit={() => {
              setEditingTodayConfidence(true);
              setConfidenceSavedFlash(false);
            }}
            onCancelEdit={() => {
              setEditingTodayConfidence(false);
              const sd = today?.survey_date?.slice(0, 10);
              if (token && sd) void checkMyResponse(token, sd);
            }}
            justSaved={confidenceSavedFlash}
            pendingGrantRedo={pendingGrantToday === "redo_full"}
            submitting={submitting}
            submitDisabled={surveyUiLocked}
            onSubmit={handleSubmit}
            onGaugeChange={(v) => {
              setGaugePosition(v);
              setKospiAnswer(v > 0);
            }}
            error={error}
            showTeamChatLink={!editingTodayConfidence}
          />
          {showNextPreSurvey && nextSurvey?.survey_date && (
            <div className="mt-4 border-t border-[#2A2A2A] pt-5">
              <NextPreSurveyPanel
                surveyDate={nextSurvey.survey_date}
                responseKnown={nextMyResponseKnown}
                submitted={nextSubmitted}
                alreadyAnswered={nextAlreadyAnswered}
                pendingGrantRedo={pendingGrantNext === "redo_full"}
                gaugeValue={nextGaugePosition}
                onGaugeChange={(v) => {
                  setNextGaugePosition(v);
                  setNextKospiAnswer(v > 0);
                }}
                userTokens={userTokens}
                submitting={nextSubmitting}
                submitDisabled={surveyUiLocked}
                onSubmit={handleNextSubmit}
                error={error}
                editingConfidence={editingNextConfidence}
                onStartEditConfidence={() => {
                  setEditingNextConfidence(true);
                  setNextConfidenceSavedFlash(false);
                }}
                onCancelEditConfidence={() => {
                  setEditingNextConfidence(false);
                  if (token && nextSurvey.survey_date) {
                    void loadNextMyResponse(token, nextSurvey.survey_date);
                  }
                }}
                confidenceJustSaved={nextConfidenceSavedFlash}
              />
            </div>
          )}
        </div>
      )}

      {/* 설문 진행 중 — 투표 폼 */}
      {status === "open" && !isWeekendKST && !alreadyAnswered && !submitted && (
        <div className="space-y-4 mt-4 fade-up">
          <p className={`text-center ${surveyUi.hint}`}>09:00 마감 · 게이지로 방향·확신도 선택</p>
          <div className="w-full min-w-0">
            <SurveyGaugeSubmit
              gaugeValue={gaugePosition}
              onGaugeChange={(v) => { setGaugePosition(v); setKospiAnswer(v > 0); }}
              userTokens={userTokens}
              submitting={submitting}
              submitDisabled={surveyUiLocked}
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
                <NextPreSurveyPanel
                  surveyDate={nextSurvey.survey_date}
                  responseKnown={nextMyResponseKnown}
                  submitted={nextSubmitted}
                  alreadyAnswered={nextAlreadyAnswered}
                  pendingGrantRedo={pendingGrantNext === "redo_full"}
                  gaugeValue={nextGaugePosition}
                  onGaugeChange={(v) => {
                    setNextGaugePosition(v);
                    setNextKospiAnswer(v > 0);
                  }}
                  userTokens={userTokens}
                  submitting={nextSubmitting}
                  submitDisabled={surveyUiLocked}
                  onSubmit={handleNextSubmit}
                  error={error}
                  editingConfidence={editingNextConfidence}
                  onStartEditConfidence={() => {
                    setEditingNextConfidence(true);
                    setNextConfidenceSavedFlash(false);
                  }}
                  onCancelEditConfidence={() => {
                    setEditingNextConfidence(false);
                    if (token && nextSurvey.survey_date) {
                      void loadNextMyResponse(token, nextSurvey.survey_date);
                    }
                  }}
                  confidenceJustSaved={nextConfidenceSavedFlash}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {!isWeekendKST ? (
        <div className="mt-8 mb-3">
          <WeeklyParticipationCard status={peekDashboardSnapshot()?.dash?.participation} />
        </div>
      ) : null}

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
