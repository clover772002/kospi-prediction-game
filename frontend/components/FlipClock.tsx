"use client";

import { useEffect, useState, useRef } from "react";

function getSecondsUntilNextSurvey(): number {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  const todaySurvey = new Date(kst);
  todaySurvey.setHours(8, 48, 0, 0);

  let target = new Date(todaySurvey);
  if (kst >= todaySurvey) {
    target.setDate(target.getDate() + 1);
  }
  // 주말 건너뛰기
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const CARD_H = 56;
const HALF_H = CARD_H / 2;

function HalfDigit({
  value,
  half,
  dim = false,
}: {
  value: string;
  half: "top" | "bottom";
  dim?: boolean;
}) {
  return (
    <div
      style={{
        height: HALF_H,
        overflow: "hidden",
        position: "relative",
      }}
      className={half === "top" ? "rounded-t-md bg-[#1E1E1E]" : "rounded-b-md bg-[#181818]"}
    >
      {/* 전체 높이 div 안에 숫자를 센터 정렬 — overflow:hidden이 절반만 보이게 함 */}
      <div
        style={{
          height: CARD_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: half === "bottom" ? -HALF_H : 0,
        }}
      >
        <span
          className="tabular-nums font-black select-none"
          style={{
            fontSize: 26,
            lineHeight: 1,
            color: dim ? "rgba(255,255,255,0.55)" : "#fff",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function FlipCard({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(prevDigit);
  const savedPrev = prevRef.current;

  useEffect(() => {
    if (digit !== prevRef.current) {
      setAnimating(true);
      prevRef.current = digit;
      const t = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(t);
    }
  }, [digit]);

  return (
    <div
      className="relative select-none rounded-md"
      style={{ width: 36, height: CARD_H, perspective: 300 }}
    >
      {/* 정적: 상단 (현재값) */}
      <HalfDigit value={digit} half="top" />
      {/* 중앙 구분선 */}
      <div style={{ height: 1, background: "#000", position: "relative", zIndex: 5 }} />
      {/* 정적: 하단 (현재값) */}
      <HalfDigit value={digit} half="bottom" dim />

      {/* 애니메이션: 이전값 상단이 아래로 접힘 */}
      {animating && (
        <div
          className="flip-top"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: HALF_H,
            overflow: "hidden",
            zIndex: 10,
            transformOrigin: "bottom center",
            borderRadius: "6px 6px 0 0",
            background: "#2A2A2A",
          }}
        >
          <div
            style={{
              height: CARD_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="tabular-nums font-black" style={{ fontSize: 26, lineHeight: 1, color: "#fff" }}>
              {savedPrev}
            </span>
          </div>
        </div>
      )}

      {/* 애니메이션: 새값 하단이 위에서 펼쳐짐 */}
      {animating && (
        <div
          className="flip-bottom"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: HALF_H,
            overflow: "hidden",
            zIndex: 10,
            transformOrigin: "top center",
            borderRadius: "0 0 6px 6px",
            background: "#1E1E1E",
          }}
        >
          <div
            style={{
              height: CARD_H,
              marginTop: -HALF_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="tabular-nums font-black" style={{ fontSize: 26, lineHeight: 1, color: "rgba(255,255,255,0.55)" }}>
              {digit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlipUnit({ value, label }: { value: string; label: string }) {
  const d0 = value[0];
  const d1 = value[1];
  const prevD0 = useRef(d0);
  const prevD1 = useRef(d1);

  const p0 = prevD0.current;
  const p1 = prevD1.current;
  prevD0.current = d0;
  prevD1.current = d1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-0.5">
        <FlipCard digit={d0} prevDigit={p0} />
        <FlipCard digit={d1} prevDigit={p1} />
      </div>
      <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{label}</span>
    </div>
  );
}

export default function FlipClock() {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    setSecs(getSecondsUntilNextSurvey());
    const id = setInterval(() => setSecs(getSecondsUntilNextSurvey()), 1000);
    return () => clearInterval(id);
  }, []);

  if (secs === null) return null;

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return (
    <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-2xl p-4">
      <p className="text-xs text-gray-500 text-center mb-3 tracking-widest uppercase">다음 설문까지</p>
      <div className="flex items-center justify-center gap-2">
        <FlipUnit value={pad(h)} label="시간" />
        <span className="text-2xl font-black text-gray-600 mb-4">:</span>
        <FlipUnit value={pad(m)} label="분" />
        <span className="text-2xl font-black text-gray-600 mb-4">:</span>
        <FlipUnit value={pad(s)} label="초" />
      </div>
      <p className="text-xs text-gray-600 text-center mt-3">
        다음 영업일 <span className="text-white font-bold">08:48</span> 설문 발송
      </p>
    </div>
  );
}
