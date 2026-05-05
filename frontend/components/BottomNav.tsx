"use client";

import { usePathname, useRouter } from "next/navigation";
import ShareSheet from "@/components/ShareSheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/setup",     label: "설정",     icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#222] z-50">
      <div className="max-w-md mx-auto flex items-center">
        {/* 대시보드 */}
        {(() => {
          const item = NAV_ITEMS[0];
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })()}

        {/* 가운데 공유 버튼 */}
        <div className="flex flex-col items-center py-2 px-5">
          <ShareShareButton />
        </div>

        {/* 설정 */}
        {(() => {
          const item = NAV_ITEMS[1];
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })()}
      </div>
    </nav>
  );
}

function ShareShareButton() {
  return (
    <ShareSheet
      title="투자자 층간소음 — 코스피 예측 게임"
      text="코스피 오를지 내릴지 맞혀보세요! 같이 해봐요 📊"
      renderTrigger={(onClick) => (
        <button
          onClick={onClick}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors active:scale-90"
        >
          <div className="w-10 h-10 rounded-full bg-[#1E1E1E] border border-[#333] flex items-center justify-center -mt-5 shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span className="text-[10px] font-medium">공유</span>
        </button>
      )}
    />
  );
}
