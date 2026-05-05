"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import ShareSheet from "@/components/ShareSheet";

const SHOW_DELAY_MS = 4000;   // 페이지 진입 후 4초 뒤 등장
const SCROLL_THRESHOLD = 100; // 스크롤이 있으면 100px 내려도 등장
const SESSION_KEY = "share_banner_dismissed";

export default function FloatingShareBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 로그인 페이지(/)에서는 표시 안 함
  const isLoginPage = pathname === "/";

  useEffect(() => {
    if (isLoginPage) return;

    // 세션에서 이미 닫은 경우 표시 안 함
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDismissed(true);
      return;
    }

    setVisible(false);

    // 타이머 트리거: 4초 뒤 등장
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    // 스크롤 트리거: 100px 이상이면 즉시 등장
    function onScroll() {
      if (window.scrollY > SCROLL_THRESHOLD) {
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, isLoginPage]);

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  if (isLoginPage || dismissed) return null;

  return (
    <div
      className="fixed z-40 left-0 right-0 flex justify-center pointer-events-none px-4"
      style={{
        bottom: "72px",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
        transform: visible ? "translateY(0)" : "translateY(28px)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-2xl shadow-2xl w-full max-w-sm"
        style={{
          background: "linear-gradient(135deg, #1C1C1C 0%, #252525 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        }}
      >
        {/* 아이콘 */}
        <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">친구에게 공유하기</p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">코스피 예측 같이 해봐요 📊</p>
        </div>

        {/* 공유 버튼 */}
        <ShareSheet
          title="투자자 층간소음 — 코스피 예측 게임"
          text="코스피 오를지 내릴지 맞혀보세요! 같이 해봐요 📊"
          renderTrigger={(onClick) => (
            <button
              onClick={onClick}
              className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
            >
              공유
            </button>
          )}
        />

        {/* 닫기 */}
        <button
          onClick={handleDismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
