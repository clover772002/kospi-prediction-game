"use client";

import React, { useState, useEffect, useRef } from "react";

interface ShareSheetProps {
  url?: string;
  title?: string;
  text?: string;
  renderTrigger?: (onClick: () => void) => React.ReactNode;
}

interface ShareApp {
  name: string;
  icon: string;
  bg: string;
  getUrl: (url: string, text: string) => string;
}

const SHARE_APPS: ShareApp[] = [
  {
    name: "카카오톡",
    icon: "/icons/kakao.svg",
    bg: "#FEE500",
    getUrl: (url, text) =>
      `https://sharer.kakao.com/talk/friends/picker/link?app_key=&validation_action=default&validation_params=%7B%7D&ka=sdk%2F1.2.0+os%2Fjavascript+sdk_type%2Fjavascript+lang%2Fko-KR+device%2FDesktop+origin%2F${encodeURIComponent(
        typeof window !== "undefined" ? window.location.origin : ""
      )}&lcba=&url=${encodeURIComponent(url)}`,
  },
  {
    name: "텔레그램",
    icon: "✈️",
    bg: "#2AABEE",
    getUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "페이스북",
    icon: "f",
    bg: "#1877F2",
    getUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "X(트위터)",
    icon: "𝕏",
    bg: "#000000",
    getUrl: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "Gmail",
    icon: "M",
    bg: "#EA4335",
    getUrl: (url, text) =>
      `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
  },
  {
    name: "문자",
    icon: "💬",
    bg: "#22C55E",
    getUrl: (url, text) =>
      `sms:?body=${encodeURIComponent(text + "\n" + url)}`,
  },
  {
    name: "라인",
    icon: "L",
    bg: "#06C755",
    getUrl: (url, text) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
  },
  {
    name: "밴드",
    icon: "B",
    bg: "#00C73C",
    getUrl: (url, text) =>
      `https://band.us/plugin/share?body=${encodeURIComponent(text + "\n" + url)}&route=${encodeURIComponent(url)}`,
  },
];

export default function ShareSheet({ url, title, text, renderTrigger }: ShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const shareTitle = title ?? "주식장 직전 8:48, 코스피 예측";
  const shareText = text ?? "설문 빅데이터 집단지성으로 성투하자";
  /** 네이티브 공유는 title/text 분리, 단일 본문만 지원하는 앱용 */
  const combinedShareText = `${shareTitle}\n${shareText}`;

  const canNativeShare =
    typeof navigator !== "undefined" && !!navigator.share;

  function handleShareClick() {
    if (canNativeShare) {
      navigator
        .share({ title: shareTitle, text: shareText, url: shareUrl })
        .catch(() => {});
    } else {
      setOpen(true);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <>
      {renderTrigger ? (
        renderTrigger(handleShareClick)
      ) : (
        <button
          onClick={handleShareClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#333] text-gray-300 hover:text-white transition-all active:scale-95 text-sm font-semibold"
          aria-label="공유하기"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          공유
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div
            ref={sheetRef}
            className="w-full max-w-md bg-[#141414] rounded-t-3xl pb-safe"
            style={{ animation: "slideUp 0.22s ease-out" }}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#444] rounded-full" />
            </div>

            {/* 제목 */}
            <div className="px-5 pt-2 pb-4 flex items-center justify-between">
              <p className="font-black text-white text-base">공유하기</p>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            {/* 앱 아이콘 그리드 */}
            <div className="px-4 pb-4 grid grid-cols-4 gap-x-3 gap-y-4">
              {SHARE_APPS.map((app) => (
                <button
                  key={app.name}
                  onClick={() => {
                    window.open(app.getUrl(shareUrl, combinedShareText), "_blank");
                  }}
                  className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md text-white font-black text-xl select-none"
                    style={{ backgroundColor: app.bg }}
                  >
                    {app.icon.startsWith("/") ? (
                      <img src={app.icon} alt={app.name} className="w-8 h-8" />
                    ) : (
                      <span>{app.icon}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium">{app.name}</span>
                </button>
              ))}
            </div>

            {/* 구분선 */}
            <div className="mx-5 border-t border-[#222] mb-4" />

            {/* 링크 복사 + Quick Share */}
            <div className="px-4 pb-6 space-y-3">
              {/* 링크 복사 */}
              <div className="flex items-center gap-3 bg-[#1C1C1C] rounded-2xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">링크</p>
                  <p className="text-xs text-gray-300 truncate">{shareUrl}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {copied ? "✓ 복사됨" : "복사"}
                </button>
              </div>

              {/* Quick Share (네이티브 지원 시) */}
              {canNativeShare && (
                <button
                  onClick={() => {
                    setOpen(false);
                    navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(() => {});
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#1C1C1C] hover:bg-[#252525] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 border border-[#2A2A2A]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  Quick Share (기기 앱 선택)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
