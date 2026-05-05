"use client";

import { useEffect, useState } from "react";
import FloatingShareBanner from "@/components/FloatingShareBanner";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NaverApp|DaumApps|Snapchat|Twitter/i.test(ua);
}

function openExternal() {
  const url = window.location.href;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);

  if (isAndroid) {
    // Android: Intent URL로 Chrome 강제 실행
    window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    // iOS: Chrome 시도 → 실패 시 Safari fallback
    const chromeTry = `googlechrome://${url.replace(/^https?:\/\//, "")}`;
    window.location.href = chromeTry;
    setTimeout(() => {
      window.location.href = url;
    }, 1500);
  }
}

export default function InAppBrowserGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [os, setOs] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    if (isInAppBrowser()) {
      setBlocked(true);
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua)) setOs("android");
      else if (/iPhone|iPad|iPod/i.test(ua)) setOs("ios");
    }
  }, []);

  if (!blocked) return (
    <>
      {children}
      <FloatingShareBanner />
    </>
  );

  return (
    <div className="fixed inset-0 bg-[#0D0D0D] flex flex-col items-center justify-center px-6 text-center z-[9999]">
      {/* 아이콘 */}
      <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-4xl mb-6">
        📊
      </div>

      <h1 className="text-xl font-bold text-white mb-2">
        외부 브라우저에서 열어야 해요
      </h1>
      <p className="text-sm text-gray-400 mb-1">
        현재 앱 내 브라우저에서는
      </p>
      <p className="text-sm text-gray-400 mb-8">
        로그인·알림 기능이 정상 작동하지 않아요.
      </p>

      {/* 메인 버튼 */}
      <button
        onClick={openExternal}
        className="w-full max-w-xs py-4 bg-white text-gray-900 font-bold rounded-2xl text-base active:scale-95 transition-all mb-4"
      >
        {os === "ios" ? "🍎 Safari / Chrome으로 열기" : "🌐 Chrome으로 열기"}
      </button>

      {/* 수동 안내 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-full max-w-xs">
        <p className="text-xs text-gray-500 mb-2 font-semibold">버튼이 안 될 경우</p>
        {os === "ios" ? (
          <p className="text-xs text-gray-400 leading-relaxed">
            하단 <span className="text-white">공유 버튼(□↑)</span>을 누른 뒤<br />
            <span className="text-white">"Safari로 열기"</span> 또는<br />
            <span className="text-white">"Chrome으로 열기"</span>를 선택하세요
          </p>
        ) : (
          <p className="text-xs text-gray-400 leading-relaxed">
            우측 상단 <span className="text-white">⋮ 메뉴</span>를 누른 뒤<br />
            <span className="text-white">"Chrome으로 열기"</span>를 선택하세요
          </p>
        )}
      </div>
    </div>
  );
}
