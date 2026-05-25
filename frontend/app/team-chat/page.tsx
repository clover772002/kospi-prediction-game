"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getDirectionChatRoom,
  getMe,
  postDirectionChatMessage,
  type DirectionChatMessageRow,
  type DirectionChatStatus,
} from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import PushConnectBanner from "@/components/PushConnectBanner";
import AppTabNav from "@/components/AppTabNav";
import PageLoadProgress from "@/components/PageLoadProgress";
import FgiDigestPanel from "@/components/team-chat/FgiDigestPanel";
import RoomCloseCountdown from "@/components/team-chat/RoomCloseCountdown";
import TeamChatCrownFxLayer from "@/components/team-chat/TeamChatCrownFxLayer";
import TeamChatMessageLabel from "@/components/team-chat/TeamChatMessageLabel";
import { useTeamChatCrownFx } from "@/components/team-chat/useTeamChatCrownFx";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function bubbleClass(isMine: boolean, side: "up" | "down"): string {
  if (isMine) {
    return "bg-amber-400 text-gray-900";
  }
  return side === "up" ? "bg-market-up" : "bg-market-down";
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
  const [hasPush, setHasPush] = useState(false);
  const [hasTelegram, setHasTelegram] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const refresh = useCallback(async (accessToken: string, sd: string | null, silent = false) => {
    if (!silent) setErr(null);
    const room = await getDirectionChatRoom(accessToken, sd ?? undefined);
    const { messages: msgs, ...st } = room;
    setStatus(st);
    setMessages(msgs);
    setSurveyDate(room.survey_date);
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
        const [me] = await Promise.all([getMe(token), refresh(token, null)]);
        if (!cancelled) {
          setHasPush(Boolean(me.has_push));
          setHasTelegram(me.telegram_chat_id != null);
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
  }, [token, refresh]);

  useEffect(() => {
    if (!token || !surveyDate || boot) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refresh(token, surveyDate, true).catch(() => {});
    };
    const id = window.setInterval(tick, 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const total = status?.member_counts.total ?? 0;
  const mySide = status?.my_side;
  const crownFx = useTeamChatCrownFx(status?.accuracy_leader_user_id, boot, messages);

  if (boot) {
    return <PageLoadProgress label="소통방 불러오는 중…" accent="blue" />;
  }

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col app-page-tab-pad text-white ${
        crownFx.screenZoom ? "team-chat-room-zoom" : ""
      }`}
    >
      <AppAmbientBackground />
      <TeamChatCrownFxLayer fx={crownFx} />

      <header className="relative z-10 shrink-0 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-base font-black min-w-0">{status?.room_title ?? "소통방"}</h1>
          <RoomCloseCountdown
            roomOpen={Boolean(status?.room_open)}
            roomCloseAt={status?.room_close_at}
            surveyDate={surveyDate}
          />
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          {surveyDate ? `${surveyDate} · 참여 ${total}명` : "불러오는 중…"}
          {status?.my_team_label ? (
            <span className="ml-2 text-gray-500">
              · 내 예측{" "}
              <span className={mySide === "up" ? "text-market-up" : "text-market-down"}>
                {status.my_team_label}
              </span>
            </span>
          ) : null}
        </p>
        {!status?.room_open && status?.room_closed_reason ? (
          <p className="mt-1 text-xs text-amber-300/90">{status.room_closed_reason}</p>
        ) : null}
      </header>

      {!boot ? <FgiDigestPanel /> : null}

      {err ? (
        <p className="relative z-10 mx-4 mt-2 shrink-0 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {err}
        </p>
      ) : null}

      {!boot && status?.answered ? (
        <PushConnectBanner
          accessToken={token}
          hasPush={hasPush}
          hasTelegram={hasTelegram}
          context="team-chat"
        />
      ) : null}

      {!boot && status && !status.answered ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-gray-300 leading-relaxed">
            오늘 설문 또는 다음 거래일 사전 예측에 참여하면
            <br />
            여기서 바로 소통할 수 있어요.
          </p>
          <Link
            href="/survey"
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black"
          >
            설문·사전 예측 하러 가기
          </Link>
        </div>
      ) : (
        <>
          <div className="relative z-10 min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && !boot ? (
              <p className="py-12 text-center text-sm text-gray-500">
                아직 메시지가 없어요.
                <br />
                첫 메시지를 남겨 보세요.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.is_mine ? "items-end" : "items-start"}`}
                >
                  <TeamChatMessageLabel
                    userId={m.user_id}
                    displayLabel={m.display_label}
                    time={formatTime(m.created_at)}
                    isLeader={Boolean(m.is_accuracy_leader)}
                    fx={crownFx}
                  />
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-snug ${bubbleClass(
                      m.is_mine,
                      m.side,
                    )}`}
                  >
                    {m.body}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {status?.can_send ? (
            <div className="relative z-10 shrink-0 border-t border-white/10 bg-[#141414]/95 px-3 py-2.5 pb-[max(8px,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex max-w-md gap-2">
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
                  placeholder="메시지 입력"
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white placeholder:text-gray-600"
                  disabled={sending}
                  autoFocus
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
            </div>
          ) : status?.answered && !status.room_open ? (
            <p className="relative z-10 shrink-0 py-3 text-center text-xs text-gray-500">
              이 거래일 방이 종료되었습니다. 다음 거래일 설문·사전 예측 후 새 소통방이 열립니다.
            </p>
          ) : status?.send_blocked_reason ? (
            <p className="relative z-10 shrink-0 py-3 text-center text-xs text-gray-500">
              {status.send_blocked_reason}
            </p>
          ) : null}
        </>
      )}

      <AppTabNav />
    </div>
  );
}
