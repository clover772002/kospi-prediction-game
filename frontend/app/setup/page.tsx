"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, unlinkTelegram, getVapidPublicKey, savePushSubscription, deletePushSubscription, savePushPreferences, createGroup, joinGroup, getMyGroups, leaveGroup, UserProfile, Group, PushPreferences } from "@/lib/api";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import PageLoadProgress from "@/components/PageLoadProgress";
import AppTabNav from "@/components/AppTabNav";
import { clearAllTabSnapshots } from "@/lib/tab-session-cache";

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
  const [tab, setTab] = useState<"telegram" | "webpush">("webpush");
  const [pushLinked, setPushLinked]   = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError]     = useState<string | null>(null);
  const DEFAULT_PREFS: PushPreferences = {
    survey_open: true, survey_deadline: true,
    result: true, challenge: true, group_nudge: true,
  };
  const [prefs, setPrefs]             = useState<PushPreferences>(DEFAULT_PREFS);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupName, setGroupName]     = useState("");
  const [isIOS, setIsIOS]             = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInApp, setIsInApp]         = useState(false);
  const [canInstall, setCanInstall]   = useState(false);
  const [joinCode, setJoinCode]       = useState("");
  const [groupMsg, setGroupMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [copiedCode, setCopiedCode]   = useState<string | null>(null);

  // 클라이언트에서만 실행 — iOS/standalone/인앱브라우저 감지
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true
    );
    setIsInApp(/KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua));

    // PWA 설치 가능 여부 감지
    const onInstallPrompt = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    // 이미 저장된 프롬프트가 있으면 바로 표시
    if ((window as Window & { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt) {
      setCanInstall(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

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
          if (profile.push_preferences) {
            setPrefs({ ...DEFAULT_PREFS, ...profile.push_preferences });
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
    clearAllTabSnapshots();
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return <PageLoadProgress label="설정 불러오는 중…" accent="blue" />;
  }

  return (
    <main className="relative max-w-md mx-auto min-h-screen pb-36 px-5">
      <AppAmbientBackground />
      <div className="relative z-10">
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

      {/* 텔레그램 탭은 제거 — 버튼으로만 진입 가능 */}


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
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-purple-400">브라우저 알림 연결 완료!</p>
              <p className="text-[11px] text-gray-400 mt-0.5">매일 밤 <span className="text-white font-bold">22:00</span> 알림 · 탭하면 바로 설문으로</p>
            </div>
            <span className="text-green-400 text-lg flex-shrink-0">✅</span>
          </div>

          {/* PWA 설치 — 한 줄 버튼 */}
          {!isStandalone && !isIOS && (
            <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">📲</span>
                <span className="font-bold text-sm text-white">홈 화면에 추가</span>
              </div>
              <button
                onClick={async () => {
                  const p = (window as Window & { __pwaInstallPrompt?: { prompt(): Promise<void> } }).__pwaInstallPrompt;
                  if (p) {
                    await p.prompt();
                    delete (window as Window & { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt;
                    setCanInstall(false);
                  } else {
                    alert("Chrome 주소창 오른쪽 ⋮ 메뉴를 탭한 뒤\n'앱 설치' 또는 '홈 화면에 추가'를 선택해주세요.");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-xl transition-all"
              >
                설치
              </button>
            </div>
          )}
          {!isStandalone && isIOS && (
            <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">📲</span>
                <span className="font-bold text-sm text-white">홈 화면에 추가</span>
              </div>
              <span className="text-[11px] text-orange-400 font-bold">Safari 공유 → 홈추가</span>
            </div>
          )}

          {/* 알림 종류 체크박스 */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 space-y-4">
            <p className="font-black text-sm">🔔 알림 종류 설정</p>
            <p className="text-[11px] text-gray-500">받고 싶은 알림만 켜두세요</p>
            {([
              { key: "survey_open",    icon: "🌙", label: "설문 시작 알림",    desc: "매일 밤 22:00" },
              { key: "survey_deadline",icon: "⏰", label: "마감 임박 알림",    desc: "오전 08:45" },
              { key: "result",         icon: "📊", label: "실적·정확도 알림",  desc: "오후 15:35" },
              { key: "challenge",      icon: "⚔️", label: "대결 신청·결과 알림", desc: "수시" },
              { key: "group_nudge",    icon: "📣", label: "그룹 독촉 알림",    desc: "수시" },
            ] as { key: keyof PushPreferences; icon: string; label: string; desc: string }[]).map(({ key, icon, label, desc }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${prefs[key] ? "bg-purple-600" : "bg-[#333]"}`}
                  onClick={async () => {
                    const next = { ...prefs, [key]: !prefs[key] };
                    setPrefs(next);
                    if (!token) return;
                    setPrefsSaving(true);
                    try { await savePushPreferences(token, next); }
                    catch { /* ignore */ }
                    finally { setPrefsSaving(false); }
                  }}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${prefs[key] ? "left-5" : "left-0.5"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    <span>{icon}</span>{label}
                    {prefsSaving && <span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />}
                  </p>
                  <p className="text-[10px] text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
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
                <div className="bg-[#1A1A1A] border border-orange-500/40 rounded-2xl overflow-hidden">
                  {/* 헤더 */}
                  <div className="bg-orange-500/20 px-4 py-3 flex items-center gap-2 border-b border-orange-500/20">
                    <span className="text-lg">🍎</span>
                    <div>
                      <p className="font-black text-orange-300 text-sm">iPhone 알림 설정 방법</p>
                      <p className="text-[11px] text-orange-400/70">홈 화면에 추가 후 알림 허용 (1분이면 끝!)</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-5">

                    {/* STEP 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">STEP 1</span>
                        <p className="text-xs font-bold text-white">화면 하단 가운데 공유 버튼 탭</p>
                      </div>
                      {/* 시각적 예시 */}
                      <div className="bg-[#111] rounded-xl p-3 border border-[#2A2A2A]">
                        <p className="text-[10px] text-gray-500 mb-2 text-center">Safari 하단 바</p>
                        <div className="flex items-center justify-around bg-[#1C1C1E] rounded-xl px-4 py-2.5">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><path d="M5 12h14M12 19l7-7-7-7"/></svg>
                          {/* 공유 버튼 강조 */}
                          <div className="relative">
                            <div className="absolute -inset-2 bg-orange-500/30 rounded-xl animate-pulse" />
                            <div className="relative bg-orange-500 rounded-lg p-1.5">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                                <polyline points="16 6 12 2 8 6"/>
                                <line x1="12" y1="2" x2="12" y2="15"/>
                              </svg>
                            </div>
                            <p className="text-[9px] text-orange-400 text-center mt-0.5 font-bold">← 이거!</p>
                          </div>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </div>
                      </div>
                    </div>

                    {/* STEP 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">STEP 2</span>
                        <p className="text-xs font-bold text-white">팝업에서 &ldquo;홈 화면에 추가&rdquo; 선택</p>
                      </div>
                      <div className="bg-[#111] rounded-xl p-3 border border-[#2A2A2A]">
                        <p className="text-[10px] text-gray-500 mb-2 text-center">공유 팝업 (스크롤해서 찾기)</p>
                        <div className="space-y-1.5">
                          {[
                            { icon: "✉️", label: "메일" },
                            { icon: "💬", label: "메시지" },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center gap-3 bg-[#2C2C2E] rounded-xl px-3 py-2 opacity-40">
                              <span className="text-base">{item.icon}</span>
                              <span className="text-xs text-gray-300">{item.label}</span>
                            </div>
                          ))}
                          {/* 홈 화면에 추가 — 강조 */}
                          <div className="flex items-center gap-3 bg-orange-500/20 border-2 border-orange-500 rounded-xl px-3 py-2.5 relative">
                            <div className="w-8 h-8 bg-[#2C2C2E] rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            </div>
                            <span className="text-xs font-black text-white">홈 화면에 추가</span>
                            <span className="ml-auto text-orange-400 text-xs font-black">← 탭!</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STEP 3 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">STEP 3</span>
                        <p className="text-xs font-bold text-white">우측 상단 &ldquo;추가&rdquo; 탭</p>
                      </div>
                      <div className="bg-[#111] rounded-xl p-3 border border-[#2A2A2A]">
                        <p className="text-[10px] text-gray-500 mb-2 text-center">앱 이름 확인 화면</p>
                        <div className="bg-[#1C1C1E] rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A2A2A]">
                            <span className="text-xs text-blue-400">취소</span>
                            <span className="text-xs font-bold text-white">홈 화면에 추가</span>
                            <div className="bg-orange-500 rounded-lg px-3 py-1">
                              <span className="text-xs font-black text-white">추가 ←</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xl flex-shrink-0">📊</div>
                            <div>
                              <p className="text-sm font-bold text-white">코스피 예측</p>
                              <p className="text-[10px] text-gray-500">kospi-prediction.vercel.app</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STEP 4 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">STEP 4</span>
                        <p className="text-xs font-bold text-white">홈 화면 아이콘으로 다시 접속!</p>
                      </div>
                      <div className="bg-[#111] rounded-xl p-3 border border-[#2A2A2A]">
                        <p className="text-[10px] text-gray-500 mb-3 text-center">홈 화면에 생긴 아이콘 클릭</p>
                        <div className="flex justify-center gap-6">
                          {/* 다른 앱들 (흐릿) */}
                          {["🎵","📸","🗺️"].map((e) => (
                            <div key={e} className="flex flex-col items-center gap-1 opacity-30">
                              <div className="w-14 h-14 bg-[#2C2C2E] rounded-2xl flex items-center justify-center text-2xl">{e}</div>
                              <span className="text-[9px] text-gray-600">앱</span>
                            </div>
                          ))}
                          {/* 우리 앱 강조 */}
                          <div className="flex flex-col items-center gap-1 relative">
                            <div className="absolute -inset-2 bg-orange-500/20 rounded-2xl animate-pulse" />
                            <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center text-2xl border-2 border-orange-400">📊</div>
                            <span className="text-[9px] text-white font-bold">코스피</span>
                            <span className="text-[9px] text-orange-400 font-black">↑ 클릭!</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 주소 복사 버튼 */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href).catch(() => {});
                        alert("주소가 복사됐어요!\nSafari 주소창에 붙여넣기 → 홈 화면에 추가해주세요 📱");
                      }}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-xl text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      이 페이지 주소 복사하기
                    </button>
                    <p className="text-[10px] text-gray-600 text-center">복사 후 Safari 주소창에 붙여넣기 → 홈 화면에 추가</p>
                  </div>
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
                        const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
                        await reg.update();
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
                        // 설치 가능 상태면 버튼 표시
                        if ((window as Window & { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt) {
                          setCanInstall(true);
                        }
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

              <a href={botLink} target="_blank" rel="noopener noreferrer" onClick={() => setBotOpened(true)}
                className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl font-black text-xl transition-all active:scale-95"
                style={{ backgroundColor: "#0088CC", color: "#fff" }}>
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

      </div>

      <AppTabNav />
    </main>
  );
}
