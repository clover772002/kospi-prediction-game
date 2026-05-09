"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getToday, resolveApiBase, TodaySurvey } from "@/lib/api";
import FlipClock from "@/components/FlipClock";
import KospiChart from "@/components/KospiChart";
import GaugeBar from "@/components/GaugeBar";

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

  if (surveyDate <= todayStr) return { isNextDay: false, label: "오늘 장 예측", shortLabel: "오늘" };

  // 진짜 내일인지 확인
  const tom = new Date(kst); tom.setDate(tom.getDate() + 1);
  const tomorrowStr = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,"0")}-${String(tom.getDate()).padStart(2,"0")}`;

  if (surveyDate === tomorrowStr) {
    return { isNextDay: true, label: "내일 장 예측", shortLabel: "내일" };
  }
  // 주말/연휴 넘어 다음 거래일
  const [, mm, dd] = surveyDate.split("-");
  const days = ["일","월","화","수","목","금","토"];
  const d = new Date(surveyDate + "T00:00:00+09:00");
  const dayKor = days[d.getDay()];
  return { isNextDay: true, label: `다음 거래일 장 예측 (${mm}/${dd} ${dayKor})`, shortLabel: `${mm}/${dd}(${dayKor})` };
}

/** 설문 게이지: 미리보기(조작만) → 확정 후 제출 */
type GaugeSubmitPhase = "preview" | "locked";

function SurveyGaugeWithPreview({
  phase,
  setPhase,
  gaugeValue,
  onGaugeChange,
  userTokens,
  submitting,
  lockBtnClass,
  submitBtnClass,
  submitLabel,
  onSubmit,
}: {
  phase: GaugeSubmitPhase;
  setPhase: (p: GaugeSubmitPhase) => void;
  gaugeValue: number;
  onGaugeChange: (v: number) => void;
  userTokens: number;
  submitting: boolean;
  lockBtnClass: string;
  submitBtnClass: string;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
}) {
  const isPreview = phase === "preview";
  return (
    <div className="space-y-3">
      {isPreview ? (
        <>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-2.5 text-center space-y-1">
            <p className="text-cyan-300 text-xs font-black">미리보기 모드</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              슬라이더를 좌우로 움직여 방향과 배팅 토큰을 확인하세요.<br />
              <span className="text-gray-500">아직 예측이 제출·저장되지 않았습니다.</span>
            </p>
          </div>
          <GaugeBar
            value={gaugeValue}
            onChange={onGaugeChange}
            tokens={userTokens}
            disabled={submitting}
          />
          <button
            type="button"
            onClick={() => setPhase("locked")}
            disabled={submitting}
            className={`w-full py-4 font-black text-base rounded-2xl transition-all active:scale-95 ${lockBtnClass}`}
          >
            이 설정으로 확정하기
          </button>
        </>
      ) : (
        <>
          <div className="bg-[#1A1A1A] border border-emerald-500/25 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-xs font-black">예측 확정됨 · 아래 설정으로 서버에 보냅니다</p>
          </div>
          <GaugeBar
            value={gaugeValue}
            onChange={onGaugeChange}
            tokens={userTokens}
            disabled
          />
          <button
            type="button"
            onClick={() => setPhase("preview")}
            disabled={submitting}
            className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-300 hover:border-gray-500 text-sm font-bold rounded-xl transition-all"
          >
            미리보기로 다시 조정
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className={`w-full py-4 font-black text-base rounded-2xl transition-all active:scale-95 ${submitBtnClass}`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                제출 중...
              </span>
            ) : submitLabel}
          </button>
        </>
      )}
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
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kospiAnswer, setKospiAnswer] = useState<boolean | null>(null);
  const [gaugePosition, setGaugePosition] = useState<number>(10); // -100~+100, 양수=상승
  const [userTokens, setUserTokens] = useState<number>(100);
  const [userStreak, setUserStreak] = useState<number>(0);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [previousAnswer, setPreviousAnswer] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  // ref로 retrying 상태 추적 — checkMyResponse의 useCallback 클로저에서 접근용
  const retryingRef = useRef(false);

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
  /** 게이지: 미리보기만 vs 확정 후 제출 */
  const [todayGaugePhase, setTodayGaugePhase] = useState<GaugeSubmitPhase>("preview");
  const [nextGaugePhase, setNextGaugePhase] = useState<GaugeSubmitPhase>("preview");

  const loadToday = useCallback(async () => {
    try {
      const data = await getToday();
      setToday(data);
      setError(null);
      // 항상 다음 거래일 설문 확인 (주말 포함)
      fetch("/api/next-survey", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setNextSurvey(d))
        .catch(() => {});
    } catch {
      setError("설문 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchKospiPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/public/kospi-price", { cache: "no-store" });
      if (res.ok) setKospiPrice(await res.json());
    } catch {}
  }, []);

  // nudge 링크로 접근하면 토스트 표시
  useEffect(() => {
    const from  = searchParams.get("nudge_from");
    const group = searchParams.get("nudge_group");
    if (!from) return;
    const msg = group ? `📣 ${from}님이 [${group}] 독촉장을 보냈어요!` : `📣 ${from}님이 독촉장을 보냈어요!`;
    setNudgeToast(msg);
    const t = setTimeout(() => setNudgeToast(null), 4000);
    return () => clearTimeout(t);
  }, [searchParams]);

  // 장 중(09:00~15:35)이면 30초마다 갱신
  useEffect(() => {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const mins = kst.getHours() * 60 + kst.getMinutes();
    const isMarketOpen = mins >= 9 * 60 && mins < 15 * 60 + 35;
    fetchKospiPrice();
    if (isMarketOpen) {
      priceTimerRef.current = setInterval(fetchKospiPrice, 30000);
    }
    return () => { if (priceTimerRef.current) clearInterval(priceTimerRef.current); };
  }, [fetchKospiPrice]);

  const checkMyResponse = useCallback(async (tok: string) => {
    try {
      const res = await fetch("/api/survey/my-response", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.answered) {
          setAlreadyAnswered(true);
          setPreviousAnswer(data.kospi_answer);
          // 수정 중(retrying)이면 유저가 고른 선택을 덮어쓰지 않음
          if (!retryingRef.current) {
            setKospiAnswer(data.kospi_answer);
          }
        } else {
          // 수정 중이 아닐 때만 상태 초기화
          if (!retryingRef.current) {
            setAlreadyAnswered(false);
            setPreviousAnswer(null);
            setKospiAnswer(null);
          }
        }
      }
    } catch {
      // 조회 실패는 무시 — 일반 설문 화면 표시
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
          setNextGaugePosition(data.kospi_answer ? 10 : -10);
        } else {
          setNextAlreadyAnswered(false);
          setNextPreviousAnswer(null);
          setNextSubmitted(false);
          setNextGaugePosition(10);
          setNextKospiAnswer(true);
          setNextGaugePhase("preview");
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        router.replace("/");
        return;
      }
      if (session) {
        setToken(session.access_token);
        loadToday();
        checkMyResponse(session.access_token);
        // 토큰 잔액 + 스트릭 조회
        fetch(`${resolveApiBase()}/api/dashboard`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(r => r.json()).then(d => {
          if (typeof d.tokens === "number") setUserTokens(d.tokens);
          if (typeof d.current_streak === "number") setUserStreak(d.current_streak);
        }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [router, loadToday, checkMyResponse]);

  // 거래일/설문이 바뀌면 오늘 설문 게이지는 다시 미리보기부터
  useEffect(() => {
    setTodayGaugePhase("preview");
  }, [today?.survey_date, today?.status]);

  // 다음 거래일 미리설문 대상 날짜가 바뀌면 게이지 단계 초기화
  useEffect(() => {
    setNextGaugePhase("preview");
  }, [nextSurvey?.survey_date]);

  const handleSubmit = async () => {
    if (!token || kospiAnswer === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kospi_answer: kospiAnswer, gauge_position: gaugePosition }),
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
      setSubmitted(true);
      setAlreadyAnswered(true);
      setPreviousAnswer(kospiAnswer);
      retryingRef.current = false;
      setRetrying(false);
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
        const raw = await res.json().catch(() => ({}));
        throw new Error(typeof raw.detail === "string" ? raw.detail : "오류가 발생했습니다.");
      }
      setNextSubmitted(true);
      setNextAlreadyAnswered(true);
      setNextPreviousAnswer(nextKospiAnswer);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setNextSubmitting(false);
    }
  };

  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] z-50">
      <div className="max-w-md mx-auto flex">
      <button onClick={() => router.push("/survey")} className="flex-1 flex flex-col items-center py-3 gap-1 text-white">
        <span className="text-xl">📝</span>
        <span className="text-xs font-bold">설문</span>
      </button>
      <button onClick={() => router.push("/dashboard")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
        <span className="text-xl">📊</span>
        <span className="text-xs font-medium">대시보드</span>
      </button>
      <button onClick={() => router.push("/groups")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
        <span className="text-xl">👥</span>
        <span className="text-xs font-medium">그룹</span>
      </button>
      <button onClick={() => router.push("/setup")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
        <span className="text-xl">⚙️</span>
        <span className="text-xs font-medium">설정</span>
      </button>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </main>
    );
  }

  const status = today?.status ?? "no_survey";

  // API status와 무관하게 클라이언트에서 주말 여부 직접 판단
  const _kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const _kstDay = _kstNow.getDay();
  const isWeekendKST = _kstDay === 0 || _kstDay === 6;

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5">
      {/* 독촉 토스트 */}
      {nudgeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 bg-orange-500 text-white text-sm font-bold rounded-2xl shadow-xl animate-bounce-in max-w-xs text-center">
          {nudgeToast}
        </div>
      )}

      {/* 휴장일 배지 — 주말이면 status 무관하게 표시 */}
      {isWeekendKST && (() => {
        const mm = String(_kstNow.getMonth() + 1).padStart(2, "0");
        const dd = String(_kstNow.getDate()).padStart(2, "0");
        const dayNames = ["일","월","화","수","목","금","토"];
        return (
          <div className="pt-6 pb-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400">
              <span>🏖️</span>
              <span>{mm}/{dd}({dayNames[_kstDay]}) 오늘은 휴장일이에요</span>
            </div>
          </div>
        );
      })()}

      <div className="pt-4 pb-6 flex items-center justify-between gap-3">
        <div>
          {(() => {
            if (isWeekendKST) {
              // 주말: 다음 거래일 날짜 계산
              const next = new Date(_kstNow);
              next.setDate(next.getDate() + 1);
              next.setHours(0, 0, 0, 0);
              while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
              const dayNames = ["일","월","화","수","목","금","토"];
              const mm = String(next.getMonth() + 1).padStart(2, "0");
              const dd = String(next.getDate()).padStart(2, "0");
              const nextDateStr = `${next.getFullYear()}.${mm}.${dd}`;
              return (
                <>
                  <h1 className="text-lg font-black text-white leading-tight">
                    {dayNames[next.getDay()]}요일 장 예측
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">{nextDateStr} (KST)</p>
                </>
              );
            }
            const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const todayStr = `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,"0")}-${String(kst.getDate()).padStart(2,"0")}`;
            const surveyDate = today?.survey_date ?? todayStr;
            const { label } = getSurveyDayLabel(surveyDate);
            const displayDate = surveyDate.replace(/-/g, ".");
            return (
              <>
                <h1 className="text-lg font-black text-white leading-tight">{label}</h1>
                <p className="text-xs text-gray-500 mt-0.5">{displayDate} (KST)</p>
              </>
            );
          })()}
        </div>
        <div className="shrink-0">
          <FlipClock compact />
        </div>
      </div>

      {/* 설문 없음 — 대기중 vs 휴장일 구분 */}
      {/* 주말·no_survey 상태에서 다음 거래일 예측 섹션 */}
      {(status === "no_survey" || isWeekendKST) && nextSurvey?.is_open && (
        <div className="mt-4 space-y-4">
          <div className="border-t border-[#2A2A2A] pt-5">
            {(() => {
              const { shortLabel } = getSurveyDayLabel(nextSurvey.survey_date);
              return (
                <>
                  <p className="text-center text-xs text-gray-500 mb-1">{shortLabel} 예측 미리하기</p>
                  <p className="text-center font-black text-white text-base mb-4">
                    📅 {nextSurvey.survey_date.slice(5).replace("-","/")} 코스피 어떨까요?
                  </p>
                </>
              );
            })()}
            {nextMyResponseLoading ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-8 h-8 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                <p className="text-xs text-gray-500">예측 참여 여부 확인 중…</p>
              </div>
            ) : nextSubmitted || nextAlreadyAnswered ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="text-4xl">✅</div>
                <p className="text-white font-bold">{getSurveyDayLabel(nextSurvey.survey_date).shortLabel} 예측 완료!</p>
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 w-full">
                  <p className="text-xs text-gray-400 mb-1">내 예측</p>
                  <p className={`font-bold ${(nextSubmitted ? nextKospiAnswer : nextPreviousAnswer) ? "text-green-400" : "text-blue-400"}`}>
                    {(nextSubmitted ? nextKospiAnswer : nextPreviousAnswer) ? "📈 상승" : "📉 하락"}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <SurveyGaugeWithPreview
                  phase={nextGaugePhase}
                  setPhase={setNextGaugePhase}
                  gaugeValue={nextGaugePosition}
                  onGaugeChange={(v) => { setNextGaugePosition(v); setNextKospiAnswer(v > 0); }}
                  userTokens={userTokens}
                  submitting={nextSubmitting}
                  lockBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                  submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                  submitLabel={`${getSurveyDayLabel(nextSurvey.survey_date).shortLabel} 예측 제출하기`}
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
                  <p className="text-xl font-bold text-white">설문 준비 중이에요</p>
                  <p className="text-sm text-gray-400">
                    잠시 후 새로고침 해주세요
                  </p>
                </>
              ) : isPreSurvey ? (
                <>
                  <div className="text-5xl">⏳</div>
                  <p className="text-xl font-bold text-white">설문 시작 전이에요</p>
                  <p className="text-sm text-gray-400">
                    오늘 밤 22:00에 다음 거래일 설문이 열려요
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl">🏖️</div>
                  <p className="text-xl font-bold text-white">오늘은 장이 없어요</p>
                  <p className="text-sm text-gray-400">주말·공휴일에는 장이 열리지 않아요</p>
                  {nextSurvey?.is_open && (
                    <p className="text-xs text-yellow-400 mt-1">
                      💡 {getSurveyDayLabel(nextSurvey.survey_date).shortLabel} 예측은 미리 참여 가능해요
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 설문 진행 중 — 이미 완료됨 (재투표 전) */}
      {status === "open" && !isWeekendKST && alreadyAnswered && !retrying && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          <div className="grid grid-cols-2 gap-3">
            {/* 내 예측 */}
            <div className="bg-[#1A1A1A] border border-green-500/30 rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">내 예측</p>
              <p className={`font-black text-lg ${previousAnswer ? "text-green-400" : "text-red-400"}`}>
                {previousAnswer ? "📈 상승" : "📉 하락"}
              </p>
              <button
                onClick={() => { retryingRef.current = true; setRetrying(true); setSubmitted(false); setTodayGaugePhase("preview"); }}
                className="mt-2 text-[10px] text-gray-500 border border-[#333] px-2 py-1 rounded-lg hover:border-white/30 transition-all"
              >
                변경하기
              </button>
            </div>
            {/* 오늘 장 */}
            <KospiNowCard price={kospiPrice} status="open" />
          </div>

          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <p className="text-xs text-gray-500 px-4 pt-3 pb-2">📈 KODEX200 (코스피200 추종)</p>
            <KospiChart />
          </div>
        </div>
      )}

      {/* 설문 진행 중 — 투표 폼 */}
      {status === "open" && !isWeekendKST && (!alreadyAnswered || retrying) && !submitted && (
        <div className="space-y-6 mt-4 fade-up">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
            <p className="text-amber-400 font-bold text-sm">⏰ 설문 진행 중 · 장 시작 전 마감</p>
          </div>

          {retrying && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-400 text-sm text-center">
              예측을 변경할 수 있어요. 선택 후 제출하세요.
            </div>
          )}

          {/* 스트릭 뱃지 */}
          {userStreak >= 3 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
              userStreak >= 5
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : "bg-orange-500/10 border-orange-500/30 text-orange-400"
            }`}>
              <span>{userStreak >= 5 ? "🏆" : "🔥"}</span>
              <span>{userStreak}연속 적중! 배당 {userStreak >= 5 ? "×2.0" : "×1.5"} 적용 중</span>
            </div>
          )}

          {/* 코스피 단일 질문 + GaugeBar */}
          <div>
            <p className="font-bold text-white text-base mb-3">
              {(() => {
                const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
                const todayStr = `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,"0")}-${String(kst.getDate()).padStart(2,"0")}`;
                const sd = today?.survey_date ?? todayStr;
                const { shortLabel } = getSurveyDayLabel(sd);
                return `📈 코스피 ${shortLabel} 얼마나 확신하나요?`;
              })()}
            </p>
            <SurveyGaugeWithPreview
              phase={todayGaugePhase}
              setPhase={setTodayGaugePhase}
              gaugeValue={gaugePosition}
              onGaugeChange={(v) => { setGaugePosition(v); setKospiAnswer(v > 0); }}
              userTokens={userTokens}
              submitting={submitting}
              lockBtnClass="bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
              submitBtnClass="bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:text-gray-500 text-white"
              submitLabel={retrying ? "예측 변경하기" : "예측 제출하기"}
              onSubmit={handleSubmit}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      )}


      {/* 제출 완료 — 내 예측 + 코스피 차트 */}
      {status === "open" && !isWeekendKST && submitted && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1A1A1A] border border-green-500/30 rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">내 예측</p>
              <p className={`font-black text-lg ${kospiAnswer ? "text-green-400" : "text-red-400"}`}>
                {kospiAnswer ? "📈 상승" : "📉 하락"}
              </p>
              <p className="text-[10px] text-gray-600 mt-1.5">15:35 결과 공개</p>
            </div>
            <KospiNowCard price={kospiPrice} status="open" />
          </div>

          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <p className="text-xs text-gray-500 px-4 pt-3 pb-2">📈 KODEX200 (코스피200 추종)</p>
            <KospiChart />
          </div>
        </div>
      )}

      {/* 설문 마감 후 — 내 예측 + 코스피 차트 */}
      {(status === "closed" || status === "result") && !isWeekendKST && (
        <div className="flex flex-col gap-4 mt-6 fade-up">
          {/* 내 예측 + 오늘 장 나란히 */}
          {(previousAnswer !== null || alreadyAnswered) && (
            <div className="grid grid-cols-2 gap-3">
              <div className={`border rounded-2xl p-4 ${
                status === "result" && today?.kospi_result != null
                  ? (previousAnswer ?? kospiAnswer) === today.kospi_result
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/20"
                  : "bg-[#1A1A1A] border-[#2A2A2A]"
              }`}>
                <p className="text-xs text-gray-400 mb-1">내 예측</p>
                <p className={`font-black text-lg ${(previousAnswer ?? kospiAnswer) ? "text-green-400" : "text-red-400"}`}>
                  {(previousAnswer ?? kospiAnswer) ? "📈 상승" : "📉 하락"}
                </p>
                <div className="mt-1.5">
                  {status === "result" && today?.kospi_result != null ? (
                    <span className="text-xl">
                      {(previousAnswer ?? kospiAnswer) === today.kospi_result ? "✅ 적중" : "❌ 빗나감"}
                    </span>
                  ) : (
                    <p className="text-[10px] text-gray-500">15:35 결과 공개</p>
                  )}
                </div>
              </div>
              <KospiNowCard
                price={kospiPrice}
                status={status}
                resultPct={today?.kospi_change_pct ?? null}
                resultUp={today?.kospi_result ?? null}
              />
            </div>
          )}

          {/* KOSPI 차트 */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
            <p className="text-xs text-gray-500 px-4 pt-3 pb-2">📈 KODEX200 (코스피200 추종)</p>
            <KospiChart />
          </div>

          {/* 다음 거래일 미리 예측하기 (결과 공개 후) */}
          {status === "result" && nextSurvey?.is_open && (
            <div className="mt-2 space-y-4">
              <div className="border-t border-[#2A2A2A] pt-5">
                {(() => {
                  const { shortLabel } = getSurveyDayLabel(nextSurvey.survey_date);
                  return (
                    <>
                      <p className="text-center text-xs text-gray-500 mb-1">{shortLabel} 예측 미리하기</p>
                      <p className="text-center font-black text-white text-base mb-4">
                        📅 {nextSurvey.survey_date.slice(5).replace("-","/")} 코스피 어떨까요?
                      </p>
                    </>
                  );
                })()}

                {nextMyResponseLoading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500">예측 참여 여부 확인 중…</p>
                  </div>
                ) : nextSubmitted || nextAlreadyAnswered ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="text-4xl">✅</div>
                    <p className="text-white font-bold">{getSurveyDayLabel(nextSurvey.survey_date).shortLabel} 예측 완료!</p>
                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 w-full">
                      <p className="text-xs text-gray-400 mb-1">내 예측</p>
                      <p className={`font-bold ${(nextSubmitted ? nextKospiAnswer : nextPreviousAnswer) ? "text-green-400" : "text-blue-400"}`}>
                        {(nextSubmitted ? nextKospiAnswer : nextPreviousAnswer) ? "📈 상승" : "📉 하락"}
                      </p>
                    </div>
                    {nextAlreadyAnswered && !nextSubmitted && (
                      <button
                        onClick={() => { setNextAlreadyAnswered(false); setNextSubmitted(false); setNextGaugePhase("preview"); }}
                        className="text-xs text-gray-500 underline"
                      >
                        다시 선택하기
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <SurveyGaugeWithPreview
                      phase={nextGaugePhase}
                      setPhase={setNextGaugePhase}
                      gaugeValue={nextGaugePosition}
                      onGaugeChange={(v) => { setNextGaugePosition(v); setNextKospiAnswer(v > 0); }}
                      userTokens={userTokens}
                      submitting={nextSubmitting}
                      lockBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                      submitBtnClass="bg-amber-500 hover:bg-amber-400 disabled:bg-[#333] disabled:text-gray-500 text-white"
                      submitLabel={`${getSurveyDayLabel(nextSurvey.survey_date).shortLabel} 예측 제출하기`}
                      onSubmit={handleNextSubmit}
                    />
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center mt-2">
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

      <BottomNav />
    </main>
  );
}

/* ── 오늘 장 현황 카드 ──────────────────────────────────── */
function KospiNowCard({
  price,
  status,
  resultPct = null,
  resultUp = null,
}: {
  price: KospiPrice | null;
  status: string;
  resultPct?: number | null;
  resultUp?: boolean | null;
}) {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const mins = kst.getHours() * 60 + kst.getMinutes();
  const isMarketOpen = mins >= 9 * 60 && mins < 15 * 60 + 35;

  // 결과 확정 (result 상태 + kospi_result 있음)
  if (status === "result" && resultUp !== null && resultPct !== null) {
    return (
      <div className={`rounded-2xl p-4 border ${resultUp ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/20"}`}>
        <p className="text-xs text-gray-400 mb-1">오늘 장 · 종가</p>
        <p className={`font-black text-lg ${resultUp ? "text-green-400" : "text-red-400"}`}>
          {resultUp ? "📈 상승" : "📉 하락"}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${resultUp ? "text-green-400" : "text-red-400"}`}>
          {resultUp ? "+" : ""}{resultPct.toFixed(2)}%
        </p>
      </div>
    );
  }

  // 장 중 실시간
  if (isMarketOpen && price?.price) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4">
        <div className="flex items-center gap-1 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs text-gray-400">오늘 장 · 진행중</p>
        </div>
        <p className="font-black text-lg text-white tabular-nums">
          {price.price.toLocaleString()}
        </p>
        {price.change_pct !== null && (
          <p className={`text-sm font-bold mt-0.5 ${price.is_up ? "text-green-400" : "text-red-400"}`}>
            {price.is_up ? "+" : ""}{price.change_pct?.toFixed(2)}%
          </p>
        )}
      </div>
    );
  }

  // 장 마감 후 (결과 미집계)
  if (price?.price) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4">
        <p className="text-xs text-gray-400 mb-1">오늘 장 · 종가</p>
        <p className="font-black text-lg text-white tabular-nums">
          {price.price.toLocaleString()}
        </p>
        {price.change_pct !== null && (
          <p className={`text-sm font-bold mt-0.5 ${price.is_up ? "text-green-400" : "text-red-400"}`}>
            {price.is_up ? "+" : ""}{price.change_pct?.toFixed(2)}%
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 flex items-center justify-center">
      <p className="text-xs text-gray-600">데이터 로딩 중</p>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense>
      <SurveyPageInner />
    </Suspense>
  );
}
