"use client";

import { usePathname } from "next/navigation";
import ShareSheet from "@/components/ShareSheet";

// BottomNav가 있는 페이지 목록
const PAGES_WITH_NAV = ["/dashboard", "/setup", "/survey"];

export default function FloatingShareBanner() {
  const pathname = usePathname();
  const hasNav = PAGES_WITH_NAV.includes(pathname);

  return (
    <div
      className="fixed z-40 left-0 right-0 flex justify-center px-4"
      style={{ bottom: hasNav ? "72px" : "16px" }}
    >
      <div
        className="flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-2xl w-full max-w-sm"
        style={{
          background: "linear-gradient(135deg, #1C1C1C 0%, #252525 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        }}
      >
        <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">친구에게 공유하기</p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">코스피 예측 같이 해봐요 📊</p>
        </div>

        <ShareSheet
          title="투자자 층간소음 — 코스피 예측 게임"
          text="코스피 오를지 내릴지 맞혀보세요! 같이 해봐요 📊"
          renderTrigger={(onClick) => (
            <button
              onClick={onClick}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
            >
              공유
            </button>
          )}
        />
      </div>
    </div>
  );
}
