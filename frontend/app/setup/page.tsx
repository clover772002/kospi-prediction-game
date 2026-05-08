"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, unlinkTelegram, getVapidPublicKey, savePushSubscription, deletePushSubscription, createGroup, joinGroup, getMyGroups, leaveGroup, UserProfile, Group } from "@/lib/api";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Profitchat123bot";

function openInExternalBrowser() {
  const url = window.location.href;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    window.location.href = `googlechrome://${url.replace(/^https?:\/\//, "")}`;
    setTimeout(() => { window.location.href = url; }, 1000);
  }
}

export default function SetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [botOpened, setBotOpened] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [tab, setTab] = useState<"telegram" | "webpush" | "groups">("webpush");
  const [pushLinked, setPushLinked]   = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError]     = useState<string | null>(null);
  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupName, setGroupName]     = useState("");
  const [joinCode, setJoinCode]       = useState("");
  const [groupMsg, setGroupMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [copiedCode, setCopiedCode]   = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/");
        return;
      }
      if (event === "INITIAL_SESSION" && !session) {
        router.replace("/");
        return;
      }
      if (session) {
        setToken(session.access_token);
        try {
          const profile = await getMe(session.access_token);
          setUser(profile);
          if (profile.telegram_chat_id) {
            setLinked(true);
          }
          if (profile.has_push) {
            setPushLinked(true);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const botLink = user ? `https://t.me/${BOT_USERNAME}?start=${user.id}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(botLink);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const loadGroups = async () => {
    if (!token) return;
    setGroupsLoading(true);
    try {
      const list = await getMyGroups(token);
      setGroups(list);
    } catch { /* ignore */ }
    finally { setGroupsLoading(false); }
  };

  const handleCreateGroup = async () => {
    if (!token || !groupName.trim()) return;
    try {
      const res = await createGroup(token, groupName.trim());
      setGroupName("");
      setGroupMsg({ text: `✅ "${groupName}" 그룹 생성 완료! 초대 코드: ${res.invite_code}`, ok: true });
      await loadGroups();
    } catch (e: unknown) {
      setGroupMsg({ text: e instanceof Error ? e.message : "생성 실패", ok: false });
    }
    setTimeout(() => setGroupMsg(null), 4000);
  };

  const handleJoinGroup = async () => {
    if (!token || !joinCode.trim()) return;
    try {
      const res = await joinGroup(token, joinCode.trim().toUpperCase());
      setJoinCode("");
      setGroupMsg({ text: `✅ "${res.group_name}" 합류 완료!`, ok: true });
      await loadGroups();
    } catch (e: unknown) {
      setGroupMsg({ text: e instanceof Error ? e.message : "가입 실패", ok: false });
    }
    setTimeout(() => setGroupMsg(null), 4000);
  };

  const handleLeaveGroup = async (group_id: string) => {
    if (!token) return;
    try {
      await leaveGroup(token, group_id);
      setGroupMsg({ text: "탈퇴했어요", ok: true });
      await loadGroups();
    } catch { /* ignore */ }
    setTimeout(() => setGroupMsg(null), 3000);
  };

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const checkLink = useCallback(async () => {
    if (!token) return;
    setChecking(true);
    setCheckFailed(false);
    try {
      const profile = await getMe(token);
      if (profile.telegram_chat_id) {
        setLinked(true);
        setUser(profile);
      } else {
        setCheckFailed(true);
      }
    } catch (e) {
      console.error(e);
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  }, [token]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5">
      {/* 헤더 */}
      <div className="pt-8 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">🔔 알림 설정</h1>
          <p className="text-xs text-gray-400 mt-1">설문 알림을 받을 방법을 연결해주세요</p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          로그아웃
        </button>
      </div>

      {/* 유저 정보 */}
      {user && (
        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A] mb-6">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          {(linked || pushLinked) ? (
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-xs text-green-400 font-bold">✅ 연동됨</span>
              <span className="text-xs text-gray-500">
                {linked && pushLinked ? "텔레그램 · 브라우저" : linked ? "텔레그램" : "브라우저 알림"}
              </span>
            </div>
          ) : (
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">미연동</span>
          )}
        </div>
      )}

      {/* 탭 (브라우저 알림 / 텔레그램) */}
      <div className="flex gap-1.5 mb-1">
        <button
          onClick={() => setTab("webpush")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === "webpush" ? "bg-purple-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
        >
          🔔 브라우저 알림
        </button>
        <button
          onClick={() => setTab("telegram")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === "telegram" ? "bg-[#0088CC] text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
        >
          ✈️ 텔레그램
        </button>
      </div>
      {/* 텔레그램 탭 유도 문구 */}
      {tab === "webpush" && !pushLinked && (
        <p className="text-[10px] text-gray-600 text-right mb-3">
          매번 접속이 귀찮다면?{" "}
          <button onClick={() => setTab("telegram")} className="text-gray-400 underline underline-offset-2 hover:text-gray-300 transition-colors">
            텔레그램 봇 연결하기 →
          </button>
        </p>
      )}
      {tab === "telegram" && !linked && (
        <p className="text-[10px] text-blue-400/70 text-center mb-3">
          ✈️ 버튼 한 번으로 설문 알림을 받아요 — 매일 앱을 열 필요 없어요
        </p>
      )}

      {/* 알림 방식 탭 내부 중복 버튼 (숨김) */}
      {!linked && !pushLinked && (
        <div className="flex gap-2 mb-2 hidden">
          <button
            onClick={() => setTab("telegram")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === "telegram" ? "bg-blue-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
          >
            ✈️ 텔레그램 봇
          </button>
          <button
            onClick={() => setTab("webpush")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === "webpush" ? "bg-purple-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
          >
            🔔 브라우저 알림
          </button>
        </div>
      )}

      {linked ? (
        /* 연동 완료 상태 */
        <div className="space-y-5">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-black text-lg text-green-400">텔레그램 연동 완료!</p>
            <p className="text-sm text-gray-400">
              매일 밤 <span className="text-white font-bold">22:00</span>에<br />
              코스피 예측 설문이 발송됩니다.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95"
          >
            ← 대시보드로 이동
          </button>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] space-y-2 text-sm text-gray-400">
            <p className="font-bold text-white">설문 일정</p>
            <div className="space-y-1">
              <p>🌙 <span className="text-white">22:00</span> - 코스피 예측 설문 발송</p>
              <p>⏰ <span className="text-white">08:45</span> - 마감 임박 리마인더</p>
              <p>🕘 <span className="text-white">09:00</span> - 설문 마감 + 집계 결과 공개</p>
              <p>🕒 <span className="text-white">15:35</span> - 실제 결과 + 내 정확도 알림</p>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!token) return;
              if (!confirm("텔레그램 연동을 해제하면 설문을 받을 수 없어요. 해제할까요?")) return;
              setUnlinking(true);
              try {
                await unlinkTelegram(token);
                setLinked(false);
                setBotOpened(false);
                setCheckFailed(false);
                setUser(prev => prev ? { ...prev, telegram_chat_id: null } : prev);
              } catch (e) {
                console.error(e);
                alert("해제 중 오류가 발생했습니다. 다시 시도해주세요.");
              } finally {
                setUnlinking(false);
              }
            }}
            disabled={unlinking}
            className="w-full py-3 bg-[#1A1A1A] border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 rounded-xl text-sm transition-all disabled:opacity-40"
          >
            {unlinking ? "해제 중..." : "텔레그램 연동 해제"}
          </button>
        </div>
      ) : pushLinked ? (
        /* 웹 푸시 연동 완료 */
        <div className="space-y-5">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">🔔</div>
            <p className="font-black text-lg text-purple-400">브라우저 알림 연결 완료!</p>
            <p className="text-sm text-gray-400">
              매일 밤 <span className="text-white font-bold">22:00</span>에 알림이 도착합니다.<br />
              알림을 탭하면 바로 설문 페이지로 이동해요.
            </p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95">
            ← 대시보드로 이동
          </button>
          {/* 텔레그램 서브 유도 */}
          {!linked && (
            <button
              onClick={() => setTab("telegram")}
              className="w-full py-3 bg-[#1A1A1A] border border-[#0088CC]/30 text-[#0088CC]/70 hover:text-[#0088CC] hover:border-[#0088CC]/60 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>✈️</span>
              <span>매번 접속이 귀찮다면? 텔레그램 봇으로 더 편하게</span>
            </button>
          )}
          <button
            onClick={async () => {
              if (!token) return;
              if (!confirm("브라우저 알림 연결을 해제할까요?")) return;
              await deletePushSubscription(token);
              setPushLinked(false);
            }}
            className="w-full py-3 bg-[#1A1A1A] border border-red-500/20 text-red-400/60 hover:text-red-400 rounded-xl text-sm transition-all"
          >
            브라우저 알림 해제
          </button>
        </div>
      ) : tab === "webpush" ? (
        /* 웹 푸시 연동 안내 */
        (() => {
          const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
          const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
          const isInApp = typeof navigator !== "undefined" && /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);

          return (
            <div className="space-y-4">
              {/* 안내: 설문은 앱에서 직접 */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2 items-start">
                <span className="text-base flex-shrink-0">💡</span>
                <p className="text-xs text-blue-300 leading-relaxed">
                  브라우저 알림은 설문 시간을 <span className="text-white font-bold">알려주는 역할</span>만 해요.<br />
                  알림을 탭하면 앱으로 이동하고, <span className="text-white font-bold">설문 탭에서 예측</span>하면 돼요.
                </p>
              </div>

              {/* 인앱 브라우저 경고 */}
              {isInApp && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-yellow-400 text-sm font-bold">⚠️ 앱 내에서는 브라우저 알림 사용 불가</p>
                  <p className="text-xs text-gray-400">Chrome 또는 Safari에서만 작동해요.</p>
                  <button
                    onClick={openInExternalBrowser}
                    className="w-full py-3 bg-white text-gray-900 font-bold rounded-xl text-sm active:scale-95 transition-all"
                  >
                    🌐 Chrome / Safari로 열기
                  </button>
                  <p className="text-xs text-gray-600 text-center">버튼이 안 되면 텔레그램 봇 탭을 이용해주세요</p>
                </div>
              )}

              {/* iPhone — 아직 홈 화면에 추가 안 된 경우 */}
              {isIOS && !isStandalone && !isInApp && (
                <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍎</span>
                    <p className="font-bold text-orange-300 text-sm">iPhone 사용자 필독</p>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    iPhone은 Safari에서 <span className="text-white font-bold">홈 화면에 추가</span>한 뒤 앱을 열어야 브라우저 알림을 사용할 수 있어요.
                  </p>
                  <ol className="space-y-3 text-xs text-gray-300">
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Safari 하단 가운데 <span className="text-white font-bold">공유 버튼</span> (□↑) 탭</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>스크롤해서 <span className="text-white font-bold">홈 화면에 추가</span> 선택 → 추가</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>홈 화면에 생긴 <span className="text-white font-bold">앱 아이콘</span>으로 접속</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">4</span>
                      <span>설정 → 브라우저 알림 탭에서 <span className="text-white font-bold">알림 허용</span></span>
                    </li>
                  </ol>
                  <button
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        navigator.clipboard.writeText(window.location.href).catch(() => {});
                        alert("주소가 복사됐어요!\nSafari 주소창에 붙여넣기 후 홈 화면에 추가해주세요 📱");
                      }
                    }}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
                  >
                    📋 이 페이지 주소 복사하기
                  </button>
                  <p className="text-xs text-gray-600 text-center">복사 후 Safari 주소창에 붙여넣기 → 홈 화면에 추가</p>
                </div>
              )}

              {/* 알림 허용 버튼 — iOS 홈화면 앱이거나 Android/PC */}
              {(!isIOS || isStandalone) && !isInApp && (
                <>
                  <button
                    onClick={async () => {
                      if (!token) return;
                      setPushLoading(true);
                      setPushError(null);
                      try {
                        if (typeof window === "undefined" || !("Notification" in window)) {
                          setPushError("이 브라우저는 알림을 지원하지 않아요. Chrome 또는 Edge를 사용해주세요.");
                          return;
                        }
                        if (!("serviceWorker" in navigator)) {
                          setPushError("이 브라우저는 Service Worker를 지원하지 않아요.");
                          return;
                        }
                        const permission = await window.Notification.requestPermission();
                        if (permission !== "granted") {
                          setPushError("알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.");
                          return;
                        }
                        const reg = await navigator.serviceWorker.register("/sw.js");
                        await navigator.serviceWorker.ready;
                        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                          || await getVapidPublicKey();
                        if (!vapidKey) {
                          setPushError("서버 설정 오류입니다. 잠시 후 다시 시도해주세요.");
                          return;
                        }
                        const keyBytes = Uint8Array.from(
                          atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")),
                          (c) => c.charCodeAt(0)
                        );
                        const sub = await reg.pushManager.subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: keyBytes,
                        });
                        await savePushSubscription(token, sub.toJSON());
                        setPushLinked(true);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setPushError("알림 연결에 실패했어요: " + msg);
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    disabled={pushLoading}
                    className="w-full py-5 bg-purple-600 hover:bg-purple-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-black text-xl rounded-2xl transition-all active:scale-95"
                  >
                    {pushLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        연결 중...
                      </span>
                    ) : "🔔 브라우저 알림 허용하기"}
                  </button>
                  {pushError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-400 text-xs">{pushError}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()
      ) : (
        /* 연동 안내 — 2단계 UI */
        <div className="space-y-4">
          {!botOpened ? (
            /* ── STEP 1: 봇 열기 ── */
            <>
              {/* 거부감 해소 안내 */}
              <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] space-y-2">
                <p className="text-xs text-gray-300 font-bold">📌 텔레그램 봇이란?</p>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li>✅ <span className="text-white">사람이 아닌 자동 프로그램</span>입니다 — 채팅 상대가 없어요</li>
                  <li>✅ 매일 아침 설문 1개를 보내고, 결과를 알려주는 게 전부예요</li>
                  <li>✅ 내 연락처·채팅 내용은 전혀 보이지 않아요</li>
                  <li>✅ 언제든 봇 차단 한 번으로 알림을 끌 수 있어요</li>
                  <li>
                    <button
                      onClick={() => setTab("webpush")}
                      className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                    >
                      그래도 텔레그램이 부담되요 → 브라우저 알림으로!
                    </button>
                  </li>
                </ul>
              </div>

              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBotOpened(true)}
                className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl font-black text-xl transition-all active:scale-95"
                style={{ backgroundColor: "#0088CC", color: "#fff" }}
              >
                <span className="text-2xl">✈️</span>
                알림 봇 연결하기
              </a>

              <button
                onClick={handleCopy}
                className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-500 hover:text-white rounded-xl text-sm transition-all"
              >
                {copyDone ? "✅ 링크 복사됨" : "🔗 링크가 안 열리면 → 복사하기"}
              </button>

            </>
          ) : (
            /* ── STEP 2: 연동 확인 ── */
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 space-y-2">
                <p className="text-xs text-blue-400 font-bold tracking-widest uppercase">2단계</p>
                <p className="font-bold text-white">텔레그램에서 '시작'을 눌렀나요?</p>
                <p className="text-xs text-gray-400">봇이 환영 메시지를 보냈으면 아래 버튼을 눌러주세요.</p>
              </div>

              <button
                onClick={checkLink}
                disabled={checking}
                className="w-full py-5 bg-green-600 hover:bg-green-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-black text-xl rounded-2xl transition-all active:scale-95"
              >
                {checking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    확인 중...
                  </span>
                ) : "✅ 연동 확인하기"}
              </button>

              {checkFailed && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                  <p className="text-red-400 text-sm font-bold">아직 연동이 안 됐어요</p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>① 텔레그램에서 '시작' 버튼을 눌렀는지 확인하세요</li>
                    <li>② 봇이 환영 메시지를 보냈는지 확인하세요</li>
                    <li>③ 안 열렸다면 아래에서 다시 시도해보세요</li>
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setBotOpened(false); setCheckFailed(false); }}
                className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-500 hover:text-white rounded-xl text-sm transition-all"
              >
                ← 봇 다시 열기
              </button>
            </>
          )}
        </div>
      )}

      {/* 하단 내비 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] z-50">
        <div className="max-w-md mx-auto flex">
          <button onClick={() => router.push("/survey")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
            <span className="text-xl">📝</span><span className="text-xs font-medium">설문</span>
          </button>
          <button onClick={() => router.push("/dashboard")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
            <span className="text-xl">📊</span><span className="text-xs font-medium">대시보드</span>
          </button>
          <button onClick={() => router.push("/groups")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
            <span className="text-xl">👥</span><span className="text-xs font-medium">그룹</span>
          </button>
          <button className="flex-1 flex flex-col items-center py-3 gap-1 text-blue-400">
            <span className="text-xl">⚙️</span>
            <span className="text-xs font-bold">설정</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
