"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getExpertChatThreadMessages,
  postExpertChatMessage,
  postExpertChatAcceptTip,
  postExpertChatReply,
  type ExpertChatEligibility,
  type ExpertChatLeaderboardEntry,
  type ExpertChatMessageRow,
  type ExpertChatThreadSummary,
  type UserProfile,
} from "@/lib/api";
import { buildKstSurveyTodayPlaceholder } from "@/lib/survey-today-placeholder";
import {
  getExpertChatEligibilityCached,
  getExpertChatThreadsCached,
  getMeCached,
  getTodaySummaryCached,
  invalidateExpertChatThreadsCache,
  invalidateExpertEligibilityCache,
} from "@/lib/session-api-cache";
import {
  peekDashboardSnapshot,
  peekExpertChatSnapshot,
  peekSurveyTodaySnapshot,
  saveExpertChatSnapshot,
} from "@/lib/tab-session-cache";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import { ChipAmount } from "@/components/ChipAmount";
import ExpertChatTabGate from "@/components/ExpertChatTabGate";
import TokenHallOfFameRankings from "@/components/TokenHallOfFameRankings";
import TopExpertNoticeBlock from "@/components/TopExpertNoticeBlock";
import PageLoadProgress from "@/components/PageLoadProgress";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function maskFallback(id: string): string {
  const s = id.slice(0, 4);
  return s ? `참여자 (${s}…)` : "참여자";
}

function resolveInitialSurveyDate(): string {
  const expert = peekExpertChatSnapshot();
  if (expert?.surveyDate) return expert.surveyDate;
  const survey = peekSurveyTodaySnapshot();
  if (survey?.today?.survey_date) return survey.today.survey_date.slice(0, 10);
  const dash = peekDashboardSnapshot();
  if (dash?.today?.survey_date) return dash.today.survey_date.slice(0, 10);
  return buildKstSurveyTodayPlaceholder().survey_date;
}

export default function ExpertChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [surveyDate, setSurveyDate] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<ExpertChatEligibility | null>(null);
  const [threads, setThreads] = useState<ExpertChatThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExpertChatMessageRow[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [sendKey, setSendKey] = useState(newIdempotencyKey);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [awaitingCore, setAwaitingCore] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const hadSnapOnMount = useRef(false);

  const selectedThread = useMemo(
    () => threads.find((t) => t.thread_id === selectedId) ?? null,
    [threads, selectedId],
  );

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    eligibility?.top_recipients?.forEach((e: ExpertChatLeaderboardEntry) => {
      m.set(e.user_id, e.masked_name);
    });
    return m;
  }, [eligibility]);

  const pickerRecipients = useMemo(() => {
    if (!me || !eligibility) return [] as ExpertChatLeaderboardEntry[];
    const allowed = new Set(eligibility.allowed_recipient_ids);
    return eligibility.top_recipients.filter(
      (e) => e.user_id !== me.id && allowed.has(e.user_id),
    );
  }, [me, eligibility]);

  const refreshThreads = useCallback(async (accessToken: string, sd: string, el: ExpertChatEligibility) => {
    const t = await getExpertChatThreadsCached(accessToken);
    setThreads(t);
    saveExpertChatSnapshot(sd, el, t);
  }, []);

  const refreshEligibility = useCallback(async (accessToken: string, sd: string) => {
    invalidateExpertEligibilityCache();
    const e = await getExpertChatEligibilityCached(accessToken, sd);
    setEligibility(e);
  }, []);

  useLayoutEffect(() => {
    const sd = resolveInitialSurveyDate();
    setSurveyDate(sd);
    const dash = peekDashboardSnapshot();
    if (dash?.user) setMe(dash.user);
    const snap = peekExpertChatSnapshot();
    if (snap && snap.surveyDate === sd) {
      hadSnapOnMount.current = true;
      setEligibility(snap.eligibility);
      setThreads(snap.threads);
      setAwaitingCore(false);
    } else {
      hadSnapOnMount.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setAuthChecking(false);
      if (!session?.access_token) {
        router.replace("/");
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        setToken(session.access_token);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const silent = hadSnapOnMount.current;
    void (async () => {
      if (!silent) setRevalidating(true);
      setErr(null);
      try {
        const today = await getTodaySummaryCached();
        const sd = (surveyDate ?? today.survey_date)?.slice(0, 10) ?? null;
        if (!sd) {
          setAwaitingCore(false);
          return;
        }
        if (cancelled) return;
        setSurveyDate(sd);

        const e = await getExpertChatEligibilityCached(token, sd);
        if (cancelled) return;
        setEligibility(e);

        let t: ExpertChatThreadSummary[] = [];
        if (e.can_access_expert_chat) {
          if (hadSnapOnMount.current) {
            t = peekExpertChatSnapshot()?.threads ?? [];
          } else {
            t = await getExpertChatThreadsCached(token);
          }
        }
        if (cancelled) return;
        setThreads(t);
        saveExpertChatSnapshot(sd, e, t);
        setAwaitingCore(false);
      } catch (err) {
        if (!cancelled) setErr(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setRevalidating(false);
      }
    })();

    window.setTimeout(() => {
      void getMeCached(token)
        .then((prof) => {
          if (!cancelled) setMe(prof);
        })
        .catch(() => {});
    }, 50);

    return () => {
      cancelled = true;
    };
  }, [token, surveyDate]);

  useEffect(() => {
    if (!pickerRecipients.length) {
      setRecipientId(null);
      return;
    }
    const allowedIds = new Set(pickerRecipients.map((r) => r.user_id));
    if (recipientId && allowedIds.has(recipientId)) return;
    const prefer =
      eligibility?.default_recipient_id && allowedIds.has(eligibility.default_recipient_id)
        ? eligibility.default_recipient_id
        : pickerRecipients[0].user_id;
    setRecipientId(prefer);
  }, [pickerRecipients, eligibility?.default_recipient_id, recipientId]);

  useEffect(() => {
    if (!token || !selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMsgsLoading(true);
    void getExpertChatThreadMessages(token, selectedId)
      .then(({ messages: ms }) => {
        if (!cancelled) setMessages(ms);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setMsgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  async function handleSend() {
    if (!token || !surveyDate || !recipientId || !body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await postExpertChatMessage(token, {
        body: body.trim(),
        survey_date: surveyDate,
        recipient_user_id: recipientId,
        idempotency_key: sendKey,
      });
      if (typeof res.balance === "number" && eligibility) {
        setEligibility({ ...eligibility, my_balance: res.balance });
      } else if (surveyDate) {
        await refreshEligibility(token, surveyDate);
      }
      setBody("");
      setSendKey(newIdempotencyKey());
      invalidateExpertChatThreadsCache();
      if (eligibility && surveyDate) {
        await refreshThreads(token, surveyDate, eligibility);
      }
      if (res.thread_id) {
        setSelectedId(res.thread_id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleReply() {
    if (!token || !selectedThread || !replyBody.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await postExpertChatReply(token, {
        thread_id: selectedThread.thread_id,
        body: replyBody.trim(),
      });
      setReplyBody("");
      const { messages: ms } = await getExpertChatThreadMessages(token, selectedThread.thread_id);
      setMessages(ms);
      invalidateExpertChatThreadsCache();
      if (eligibility && surveyDate) {
        await refreshThreads(token, surveyDate, eligibility);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptTip(messageId: string) {
    if (!token || !selectedThread) return;
    setBusy(true);
    setErr(null);
    try {
      await postExpertChatAcceptTip(token, { message_id: messageId });
      const { messages: ms } = await getExpertChatThreadMessages(token, selectedThread.thread_id);
      setMessages(ms);
      invalidateExpertChatThreadsCache();
      if (eligibility && surveyDate) {
        await refreshThreads(token, surveyDate, eligibility);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function displayName(uid: string): string {
    return nameMap.get(uid) ?? maskFallback(uid);
  }

  if (authChecking || !token) {
    return <PageLoadProgress label="확인 중…" accent="blue" />;
  }

  const chatUnlocked = Boolean(eligibility?.can_access_expert_chat);
  const actionLocked = awaitingCore || busy;

  return (
    <>
      <StaleRefreshIndicator show={awaitingCore || revalidating} tone="violet" />
      <AppAmbientBackground />
      <main className="relative z-10 mx-auto min-h-screen max-w-md px-4 app-page-tab-pad pt-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">
            ← 대시보드
          </Link>
          {surveyDate ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-400">
              기준일 {surveyDate}
            </span>
          ) : null}
        </div>

        <h1 className="mb-1 text-2xl font-black text-white">명예의 전당</h1>
        <p className="mb-4 text-center text-xs text-gray-500">칩·적중률 순위 · 초고수 소통</p>

        <TokenHallOfFameRankings accessToken={token} meId={me?.id ?? null} />

        {me && eligibility ? (
          <div className="mb-4">
            <TopExpertNoticeBlock
              userId={me.id}
              isGlobalTopExpert={eligibility.is_global_top_expert}
              receivesToday={eligibility.receives_expert_questions_today}
              expertChatUnlocked={eligibility.can_access_expert_chat}
            />
          </div>
        ) : null}

        <h2 className="mb-2 text-lg font-black text-violet-200/95">초고수 소통</h2>
        <p className="mb-4 text-xs text-gray-500 flex flex-wrap items-center gap-1">
          <ChipAmount amount={eligibility?.min_balance_for_tab ?? 210} compact className="text-amber-200/90" />
          <span>이상이면 질문·답장 이용 · 순위는 누구나 볼 수 있어요</span>
        </p>

        {awaitingCore ? (
          <p className="mb-6 text-center text-xs text-gray-500">초고수 소통 정보 불러오는 중…</p>
        ) : eligibility && !chatUnlocked ? (
          <ExpertChatTabGate
            myBalance={eligibility.my_balance}
            minBalance={eligibility.min_balance_for_tab}
            tipPerMessage={eligibility.tip_tokens_per_message}
            reason={eligibility.tab_blocked_reason}
            compact
          />
        ) : (
          <>
            {eligibility && !eligibility.is_global_top_expert ? (
              <p className="mb-4 text-sm leading-relaxed text-white/90">
                오늘 설문에 참여한 <strong className="text-white">🪙 1위 초고수</strong>에게 질문을 보낼 수 있습니다.
                질문 1통당 <ChipAmount amount={eligibility.tip_tokens_per_message} compact className="text-amber-200" />
                차감되며, 초고수가 <strong className="text-white">팁을 수락할 때</strong> 전달됩니다.
              </p>
            ) : null}

            {err ? (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {err}
              </div>
            ) : null}

            {eligibility ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1">
                  내 잔액 <ChipAmount amount={eligibility.my_balance} compact className="text-amber-200" />
                </span>
                {eligibility.my_rank != null ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">내 순위 {eligibility.my_rank}위</span>
                ) : null}
                {!eligibility.can_send_message && eligibility.send_blocked_reason ? (
                  <span className="text-amber-300/80">{eligibility.send_blocked_reason}</span>
                ) : null}
              </div>
            ) : null}

            <section className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
          <h2 className="mb-2 text-sm font-bold text-white">스레드</h2>
          {threads.length === 0 ? (
            <p className="text-xs text-gray-500">아직 대화가 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {threads.map((t) => {
                const other = t.my_role === "participant" ? t.expert_user_id : t.participant_id;
                const label =
                  t.my_role === "expert" ? `질문 · ${displayName(other)}` : `초고수 · ${displayName(other)}`;
                const active = t.thread_id === selectedId;
                return (
                  <li key={t.thread_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.thread_id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                        active
                          ? "border-amber-400/40 bg-amber-500/10 text-white"
                          : "border-[#333] bg-[#1A1A1A] text-gray-300 hover:border-[#444]"
                      }`}
                    >
                      <span className="font-bold">{label}</span>
                      <span className="ml-2 text-[10px] text-gray-500">{t.survey_date}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selectedThread ? (
          <section className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4">
            <h2 className="mb-3 text-sm font-bold text-white">대화</h2>
            {msgsLoading ? (
              <p className="text-xs text-gray-500">메시지 불러오는 중…</p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {messages.map((m) => {
                  const mine = me ? m.sender_id === me.id : false;
                  const participantId = selectedThread?.participant_id ?? "";
                  const fromParticipant =
                    participantId !== "" && m.sender_id === participantId;
                  const accepted = !!(m.tip_accepted_at);
                  const tipPendingExpertAccept =
                    m.tip_tokens > 0 && !accepted && fromParticipant;
                  const showExpertTipCta =
                    selectedThread?.my_role === "expert" &&
                    tipPendingExpertAccept;
                  const showExpertTipDone =
                    selectedThread?.my_role === "expert" &&
                    m.tip_tokens > 0 &&
                    accepted &&
                    fromParticipant;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl border px-3 py-2 text-xs leading-relaxed ${
                          mine
                            ? "border-cyan-500/25 bg-cyan-900/40 text-cyan-50"
                            : "border-[#333] bg-[#222] text-gray-200"
                        }`}
                      >
                        {fromParticipant && m.tip_tokens > 0 ? (
                          <p className="mb-1 text-[10px] text-amber-200/80">
                            {accepted ? (
                              <span className="inline-flex items-center gap-1">
                                <ChipAmount amount={m.tip_tokens} compact /> 전달·수락 완료
                              </span>
                            ) : selectedThread?.my_role === "expert" ? (
                              <span className="inline-flex items-center gap-1">
                                수락 시 <ChipAmount amount={m.tip_tokens} compact />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 flex-wrap">
                                <ChipAmount amount={m.tip_tokens} compact /> 차감 · 수락 시 상대 정산
                              </span>
                            )}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[9px] text-gray-500">
                          {new Date(m.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      {showExpertTipCta ? (
                        <button
                          type="button"
                  disabled={actionLocked}
                  onClick={() => void handleAcceptTip(m.id)}
                          className="max-w-[85%] rounded-lg border border-amber-500/35 bg-amber-600/25 px-3 py-1.5 text-[11px] font-bold text-amber-100 transition-colors hover:bg-amber-600/35 disabled:opacity-45"
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            팁 <ChipAmount amount={m.tip_tokens} compact /> 수락
                          </span>
                        </button>
                      ) : showExpertTipDone ? (
                        <span className="max-w-[85%] text-[10px] text-emerald-400/85">
                          칩 수락·지급 완료
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedThread.my_role === "expert" ? (
              <div className="mt-3 space-y-2 border-t border-[#2A2A2A] pt-3">
                <span className="block text-[10px] font-bold text-gray-500">답장 (칩 없음)</span>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#333] bg-[#111] px-3 py-2 text-sm text-white placeholder:text-gray-600"
                  placeholder="답장을 입력하세요"
                />
                <button
                  type="button"
                  disabled={actionLocked || !replyBody.trim()}
                  onClick={() => void handleReply()}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  답장 보내기
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4">
          <h2 className="mb-2 text-sm font-bold text-amber-100">메시지 보내기</h2>
          <span className="mb-1 block text-[10px] font-bold text-gray-500">받는 사람 (칩 1위 초고수)</span>
          {pickerRecipients.length > 0 ? (
            <div className="mb-3 rounded-xl border border-[#333] bg-[#111] px-3 py-2.5 text-sm text-white">
              {pickerRecipients.map((r) => (
                <p key={r.user_id}>
                  {r.masked_name}
                  {r.accuracy != null ? ` · 적중 ${r.accuracy}%` : ""}
                </p>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-500">오늘 설문에 참여한 초고수가 없어요.</p>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="mb-3 w-full resize-none rounded-xl border border-[#333] bg-[#111] px-3 py-2 text-sm text-white placeholder:text-gray-600"
            placeholder="초고수에게 보낼 메시지"
            disabled={actionLocked || !eligibility?.can_send_message}
          />
          <button
            type="button"
            disabled={actionLocked || !eligibility?.can_send_message || !body.trim() || !recipientId}
            onClick={() => void handleSend()}
            className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-1 flex-wrap">
              보내기 ·
              {typeof eligibility?.tip_tokens_per_message === "number" ? (
                <ChipAmount amount={eligibility.tip_tokens_per_message} compact className="text-white" />
              ) : (
                "—"
              )}
              (즉시 차감)
            </span>
          </button>
          <p className="mt-2 text-[10px] text-gray-500">
            초고수에게 정산되는 시점은 그분이 해당 메시지에서 팁을 수락할 때예요. 같은 요청 재전송은 멱등 키로
            막히며 거래일당 전송 수에 제한이 있을 수 있어요.
          </p>
        </section>
          </>
        )}
      </main>
      <AppTabNav />
    </>
  );
}
