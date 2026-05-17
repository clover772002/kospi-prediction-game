"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getExpertChatEligibility,
  getExpertChatThreadMessages,
  getExpertChatThreads,
  getMe,
  getToday,
  postExpertChatMessage,
  postExpertChatAcceptTip,
  postExpertChatReply,
  type ExpertChatEligibility,
  type ExpertChatLeaderboardEntry,
  type ExpertChatMessageRow,
  type ExpertChatThreadSummary,
  type UserProfile,
} from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import ExpertChatTabGate from "@/components/ExpertChatTabGate";
import PageLoadProgress from "@/components/PageLoadProgress";

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
  const [boot, setBoot] = useState(true);

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

  const refreshThreads = useCallback(async (accessToken: string) => {
    const { threads: t } = await getExpertChatThreads(accessToken);
    setThreads(t);
  }, []);

  const refreshEligibility = useCallback(async (accessToken: string, sd: string) => {
    const e = await getExpertChatEligibility(accessToken, sd);
    setEligibility(e);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        router.replace("/");
        return;
      }
      setToken(session.access_token);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/");
      else setToken(session.access_token);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setBoot(true);
      setErr(null);
      try {
        const [prof, today] = await Promise.all([getMe(token), getToday()]);
        if (cancelled) return;
        setMe(prof);
        const sd = today.survey_date?.slice(0, 10) ?? null;
        setSurveyDate(sd);
        if (sd) {
          const e = await getExpertChatEligibility(token, sd);
          if (cancelled) return;
          setEligibility(e);
          if (e.can_access_expert_chat) {
            await refreshThreads(token);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshThreads]);

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
      await refreshThreads(token);
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
      await refreshThreads(token);
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
      await refreshThreads(token);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function displayName(uid: string): string {
    return nameMap.get(uid) ?? maskFallback(uid);
  }

  if (!token || boot) {
    return (
      <>
        <PageLoadProgress />
        <AppAmbientBackground />
        <main className="relative z-10 mx-auto min-h-screen max-w-md px-4 pb-24 pt-6">
          <p className="text-center text-base text-white">불러오는 중…</p>
        </main>
        <AppTabNav />
      </>
    );
  }

  const tabLocked = eligibility != null && !eligibility.can_access_expert_chat;

  if (tabLocked && eligibility) {
    return (
      <>
        <AppAmbientBackground />
        <main className="relative z-10 mx-auto min-h-screen max-w-md px-4 pb-28 pt-6">
          <h1 className="mb-4 text-center text-2xl font-black text-white">고수 소통</h1>
          <ExpertChatTabGate
            myBalance={eligibility.my_balance}
            minBalance={eligibility.min_balance_for_tab}
            tipPerMessage={eligibility.tip_tokens_per_message}
            reason={eligibility.tab_blocked_reason}
          />
        </main>
        <AppTabNav />
      </>
    );
  }

  return (
    <>
      <AppAmbientBackground />
      <main className="relative z-10 mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">
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

        <h1 className="mb-1 text-2xl font-black text-white">고수 소통</h1>
        <p className="mb-4 text-sm leading-relaxed text-white/90">
          오늘 설문 거래일 기준 코스피 리더보드 상위 참가자에게 메시지를 보낼 수 있습니다. 질문 1통당{" "}
          <span className="font-bold text-amber-200">{eligibility?.tip_tokens_per_message ?? "—"}토큰</span>이
          차감되며, 고수가 <strong className="text-white">팁을 수락할 때</strong> 해당 토큰이 전달됩니다.
        </p>

        {err ? (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        ) : null}

        {eligibility ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <span>
              내 잔액 <b className="tabular-nums text-amber-200">{eligibility.my_balance}</b>
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
                  t.my_role === "expert" ? `질문 · ${displayName(other)}` : `고수 · ${displayName(other)}`;
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
                              <>토큰 {m.tip_tokens} — 전달·수락 완료</>
                            ) : selectedThread?.my_role === "expert" ? (
                              <>내가 받을 토큰 {m.tip_tokens} (수락 시 지급)</>
                            ) : (
                              <>
                                내 토큰 {m.tip_tokens} 차감 · 고수 수락 시 상대에게 정산 대기
                              </>
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
                          disabled={busy}
                          onClick={() => void handleAcceptTip(m.id)}
                          className="max-w-[85%] rounded-lg border border-amber-500/35 bg-amber-600/25 px-3 py-1.5 text-[11px] font-bold text-amber-100 transition-colors hover:bg-amber-600/35 disabled:opacity-45"
                        >
                          팁 {m.tip_tokens}토큰 수락하기
                        </button>
                      ) : showExpertTipDone ? (
                        <span className="max-w-[85%] text-[10px] text-emerald-400/85">
                          토큰 수락·지급 완료
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedThread.my_role === "expert" ? (
              <div className="mt-3 space-y-2 border-t border-[#2A2A2A] pt-3">
                <span className="block text-[10px] font-bold text-gray-500">답장 (토큰 없음)</span>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#333] bg-[#111] px-3 py-2 text-sm text-white placeholder:text-gray-600"
                  placeholder="답장을 입력하세요"
                />
                <button
                  type="button"
                  disabled={busy || !replyBody.trim()}
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
          <span className="mb-1 block text-[10px] font-bold text-gray-500">받는 사람 (순위권 고수)</span>
          <select
            value={recipientId ?? ""}
            onChange={(e) => setRecipientId(e.target.value || null)}
            className="mb-3 w-full rounded-xl border border-[#333] bg-[#111] px-3 py-2 text-sm text-white"
            disabled={!pickerRecipients.length}
          >
            {pickerRecipients.length === 0 ? (
              <option value="">선택 가능한 고수가 없어요</option>
            ) : (
              pickerRecipients.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.rank}위 · {r.masked_name}
                  {r.accuracy != null ? ` · 적중 ${r.accuracy}%` : ""}
                </option>
              ))
            )}
          </select>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="mb-3 w-full resize-none rounded-xl border border-[#333] bg-[#111] px-3 py-2 text-sm text-white placeholder:text-gray-600"
            placeholder="고수에게 보낼 메시지"
            disabled={!eligibility?.can_send_message}
          />
          <button
            type="button"
            disabled={busy || !eligibility?.can_send_message || !body.trim() || !recipientId}
            onClick={() => void handleSend()}
            className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            보내기 · 토큰 {eligibility?.tip_tokens_per_message ?? "—"} (보내는 즉시 차감)
          </button>
          <p className="mt-2 text-[10px] text-gray-500">
            고수에게 정산되는 시점은 그분이 해당 메시지에서 팁을 수락할 때예요. 같은 요청 재전송은 멱등 키로
            막히며 거래일당 전송 수에 제한이 있을 수 있어요.
          </p>
        </section>
      </main>
      <AppTabNav />
    </>
  );
}
