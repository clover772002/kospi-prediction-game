"use client";

import { useEffect, useState, useRef } from "react";
import ShareSheet from "@/components/ShareSheet";

export default function FloatingShareBanner() {
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        // 150px 이상 스크롤 됐고, 위로 스크롤 중이거나 멈췄을 때 배너 표시
        // 아래로 빠르게 스크롤 중엔 숨김
        if (currentY > 150) {
          setVisible(true);
        } else {
          setVisible(false);
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed z-40 left-0 right-0 flex justify-center pointer-events-none"
      style={{
        bottom: "72px", // BottomNav 위
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
      }}
    >
      <ShareSheet
        title="투자자 층간소음 — 코스피 예측 게임"
        text="코스피 오를지 내릴지 맞혀보세요! 같이 해봐요 📊"
        renderTrigger={(onClick) => (
          <button
            onClick={onClick}
            className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #262626 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            친구에게 공유하기
            <span className="text-base">→</span>
          </button>
        )}
      />
    </div>
  );
}
