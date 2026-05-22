"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getDirectionChatMessages,
  getDirectionChatStatus,
  getToday,
  postDirectionChatMessage,
  type DirectionChatMessageRow,
  type DirectionChatStatus,
} from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import PageLoadProgress from "@/components/PageLoadProgress";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

export default function TeamChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [surveyDate, setSurveyDate] = useState<string | null>(null);
  const [status, setStatus] = useState<DirectionChatStatus | null>(null);
  const [messages, setMessages] = useState<DirectionChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [boot, setBoot] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const refresh = useCallback(async (accessToken: string, sd: string, silent = false) => {
    if (!silent) setErr(null);
    const st = await getDirectionChatStatus(accessToken, sd);
    setStatus(st);
    if (st.can_read) {
      const msgRes = await getDirectionChatMessages(accessToken, sd);
      setMessages(msgRes.messages);
    } else {
      setMessages([]);
    }
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
      try {
        const today = await getToday();
        const sd = today.survey_date?.slice(0, 10) ?? null;
        if (!sd) {
          setErr("오늘 거래일 설문이 없습니다.");
          return;
        }
        if (!cancelled) setSurveyDate(sd);
        await refresh(token, sd);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  useEffect(() => {
    if (!token || !surveyDate || boot) return;
    const id = window.setInterval(() => {
      void refresh(token, surveyDate, true).catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, [token, surveyDate, boot, refresh]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    if (!token || !surveyDate || !status?.can_send) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    try {
      const out = await postDirectionChatMessage(token, {
        body: text,
        survey_date: surveyDate,
      });
      setDraft("");
      setMessages((prev) => [...prev, out.message]);
      scrollToBottom();
      await refresh(token, surveyDate, true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const teamUp = status?.my_side === "up";
  const teamAccent = teamUp ? "text-emerald-400" : "text-rose-400";
  const teamBg = teamUp ? "bg-emerald-500/15 border-emerald-500/40" : "bg-rose-500/15 border-rose-500/40";

  return (
    <div className="relative min-h-[100dvh] pb-28 text-white">
      <AppAmbientBackground />
      {boot ? <PageLoadProgress /> : null}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pt-4">
        <header className="mb-3 shrink-0">
          <h1 className="text-lg font-black tracking-tight">방향 단톡방</h1>
          {surveyDate ? (
            <p className="mt-0.5 text-xs text-gray-400">
              {surveyDate} · 장 마감 시 방 종료 · 다음 거래일 새 방
            </p>
          ) : null}
        </header>

        {status?.answered ? (
          <div className={`mb-3 rounded-xl border px-3 py-2.5 text-sm ${teamBg}`}>
            <p className="font-bold">
              내 팀: <span className={teamAccent}>{status.my_team_label}팀</span>
            </p>
            <p className="mt-1 text-xs text-gray-300">
              표시 이름 <span className="font-mono text-white/90">{status.my_display_label}</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              상승 {status.member_counts.up}명 · 하락 {status.member_counts.down}명 (각 팀 방 분리)
            </p>
            {!status.room_open && status.room_closed_reason ? (
              <p className="mt-2 text-xs font-semibold text-amber-300/90">{status.room_closed_reason}</p>
            ) : null}
          </div>
        ) : null}

        {err ? (
          <p className="mb-2 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {err}
          </p>
        ) : null}

        {!boot && status && !status.answered ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            <p className="text-sm text-gray-300">
              오늘 설문에 참여해야 단톡방에 들어갈 수 있어요.
              <br />
              상승·하락 팀이 나뉘며, 팀은 예측 방향으로 자동 배정됩니다.
            </p>
            <Link
              href="/survey"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black"
            >
              설문 하러 가기
            </Link>
          </div>
        ) : (
          <>
            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 pb-2"
              style={{ maxHeight: "calc(100dvh - 280px)" }}
            >
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  아직 메시지가 없어요. 첫 인사를 남겨 보세요.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.is_mine ? "items-end" : "items-start"}`}
                  >
                    <span className="mb-0.5 text-[10px] font-semibold text-gray-500">
                      {m.display_label}
                      <span className="ml-1 text-gray-600">{formatTime(m.created_at)}</span>
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                        m.is_mine
                          ? teamUp
                            ? "bg-emerald-600/80 text-white"
                            : "bg-rose-600/80 text-white"
                          : "bg-[#2a2a2a] text-gray-100"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {status?.can_send ? (
              <div className="mt-3 shrink-0 pb-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    maxLength={status.max_body_len}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="팀 방에 메시지…"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white placeholder:text-gray-600"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
                  >
                    전송
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-600">
                  {draft.length}/{status.max_body_len} · 매매 조언·욕설 금지
                </p>
              </div>
            ) : status?.answered && !status.room_open ? (
              <p className="mt-3 shrink-0 text-center text-xs text-gray-500">
                종료된 방입니다. 내일 설문 후 새 단톡방이 열립니다.
              </p>
            ) : status?.send_blocked_reason ? (
              <p className="mt-3 shrink-0 text-center text-xs text-gray-500">{status.send_blocked_reason}</p>
            ) : null}
          </>
        )}
      </div>

      <AppTabNav />
    </div>
  );
}
