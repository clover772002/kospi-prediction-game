"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, UserProfile } from "@/lib/api";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Profitchat123bot";

export default function SetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

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

  const checkLink = useCallback(async () => {
    if (!token) return;
    setChecking(true);
    try {
      const profile = await getMe(token);
      if (profile.telegram_chat_id) {
        setLinked(true);
        setUser(profile);
      }
    } catch (e) {
      console.error(e);
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
    <main className="max-w-md mx-auto min-h-screen pb-24 px-5">
      {/* 헤더 */}
      <div className="pt-8 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">📱 텔레그램 연동</h1>
          <p className="text-xs text-gray-400 mt-1">설문 수신을 위해 봇을 연동해주세요</p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          로그아웃
        </button>
      </div>

      {/* 유저 정보 */}
      {user && (
        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A] mb-6">
          {user.picture && (
            <img src={user.picture} alt="프로필" className="w-9 h-9 rounded-full" />
          )}
          <div>
            <p className="font-bold text-sm">{user.name || user.email}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          {linked && (
            <span className="ml-auto text-xs text-green-400 font-bold">✅ 연동됨</span>
          )}
        </div>
      )}

      {linked ? (
        /* 연동 완료 상태 */
        <div className="space-y-5">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-black text-lg text-green-400">텔레그램 연동 완료!</p>
            <p className="text-sm text-gray-400">
              매일 <span className="text-white font-bold">08:50</span>에<br />
              코스피·코스닥 예측 설문이 발송됩니다.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95"
          >
            대시보드로 이동 →
          </button>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] space-y-2 text-sm text-gray-400">
            <p className="font-bold text-white">설문 일정</p>
            <div className="space-y-1">
              <p>🕛 <span className="text-white">08:50</span> - 코스피·코스닥 예측 설문 발송</p>
              <p>🕘 <span className="text-white">09:00</span> - 설문 마감 + 집계 결과 공개</p>
              <p>🕒 <span className="text-white">15:35</span> - 실제 결과 + 내 정확도 알림</p>
            </div>
          </div>
        </div>
      ) : (
        /* 연동 안내 */
        <div className="space-y-5">
          {/* 단계별 안내 */}
          {[
            {
              step: "1",
              title: "아래 버튼으로 봇 열기",
              desc: "텔레그램 앱이 열리면서 봇 채팅창이 시작됩니다.",
            },
            {
              step: "2",
              title: "시작 버튼 누르기",
              desc: "텔레그램에서 '시작' 또는 '/start' 버튼을 눌러주세요.",
            },
            {
              step: "3",
              title: "연동 확인",
              desc: "봇이 환영 메시지를 보내면 아래 '연동 확인' 버튼을 눌러주세요.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 bg-[#1A1A1A] rounded-xl px-4 py-4 border border-[#2A2A2A]">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black flex-shrink-0">
                {item.step}
              </div>
              <div>
                <p className="font-bold text-sm">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}

          {/* 봇 연동 버튼 */}
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
            style={{ backgroundColor: "#0088CC", color: "#fff" }}
          >
            <span className="text-2xl">✈️</span>
            텔레그램 봇 열기
          </a>

          {/* 링크 복사 (백업) */}
          <button
            onClick={handleCopy}
            className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-400 hover:text-white rounded-xl text-sm transition-all"
          >
            {copyDone ? "✅ 링크 복사됨" : "🔗 링크 복사하기"}
          </button>

          {/* 연동 확인 버튼 */}
          <button
            onClick={checkLink}
            disabled={checking}
            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-bold rounded-2xl transition-all"
          >
            {checking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                확인 중...
              </span>
            ) : "✅ 연동 확인하기"}
          </button>

          <p className="text-xs text-gray-600 text-center">
            봇에서 환영 메시지를 받은 후 위 버튼을 눌러주세요
          </p>
        </div>
      )}

      {/* 하단 내비 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] z-50">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">📊</span>
            <span className="text-xs font-medium">대시보드</span>
          </button>
          <button className="flex-1 flex flex-col items-center py-3 gap-1 text-blue-400">
            <span className="text-xl">⚙️</span>
            <span className="text-xs font-medium">설정</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
