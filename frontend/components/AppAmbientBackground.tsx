"use client";

/** 로그인 후 화면 공통: 은은하게 움직이는 그라데이션 배경 (콘텐츠 클릭 방해 없음) */
export default function AppAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-[22%] -left-[14%] h-[72vmin] w-[72vmin] rounded-full bg-violet-600/[0.085] blur-[64px] app-ambient-blob-a" />
      <div className="absolute bottom-[-12%] right-[-18%] h-[68vmin] w-[68vmin] rounded-full bg-amber-500/[0.07] blur-[58px] app-ambient-blob-b" />
      <div className="absolute left-1/2 top-[42%] h-[90vmin] w-[90vmin] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.045] blur-[72px] app-ambient-blob-c" />
    </div>
  );
}
