"use client";

import { ChipAmount } from "@/components/ChipAmount";
import { useCallback, useEffect, useRef, useState } from "react";

const CROWD_RISE = 1240;
const CROWD_FALL = 860;
const WALLET = 370;
const BET_UNITS = [1, 5, 10, 25] as const;

type Side = "rise" | "fall";
type Phase = "bet" | "win" | "lose";
type BetUnit = (typeof BET_UNITS)[number];

type FlyCoin = {
  id: number;
  side: Side;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function stackHeightPct(chips: number, max: number) {
  return clamp(Math.round((chips / max) * 100), 8, 100);
}

export default function ChipBalanceScalePlayground() {
  const [unit, setUnit] = useState<BetUnit>(5);
  const [myRise, setMyRise] = useState(0);
  const [myFall, setMyFall] = useState(0);
  const [mySide, setMySide] = useState<Side>("rise");
  const [phase, setPhase] = useState<Phase>("bet");
  const [displayTilt, setDisplayTilt] = useState(0);
  const [wobble, setWobble] = useState(0);
  const [flyCoins, setFlyCoins] = useState<FlyCoin[]>([]);
  const [shake, setShake] = useState(false);
  const flyId = useRef(0);
  const tiltRaf = useRef(0);

  const myBet = myRise + myFall;
  const walletLeft = WALLET - myBet;
  const riseWeight = CROWD_RISE + myRise;
  const fallWeight = CROWD_FALL + myFall;
  const maxStack = Math.max(riseWeight, fallWeight, 1);

  const targetTilt = clamp(((riseWeight - fallWeight) / 2400) * 18, -15, 15);

  useEffect(() => {
    const step = () => {
      setDisplayTilt((t) => {
        const next = t + (targetTilt - t) * 0.14;
        if (Math.abs(next - targetTilt) < 0.04) return targetTilt;
        return next;
      });
      tiltRaf.current = requestAnimationFrame(step);
    };
    tiltRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(tiltRaf.current);
  }, [targetTilt]);

  const spawnFly = useCallback((side: Side) => {
    const id = ++flyId.current;
    setFlyCoins((prev) => [...prev.slice(-6), { id, side }]);
    window.setTimeout(() => {
      setFlyCoins((prev) => prev.filter((c) => c.id !== id));
    }, 720);
  }, []);

  const bumpWobble = useCallback(() => {
    setWobble((w) => w + 1);
    window.setTimeout(() => setWobble(0), 520);
  }, []);

  const addToPan = useCallback(
    (side: Side) => {
      if (phase !== "bet") setPhase("bet");
      if (walletLeft < unit) return;

      spawnFly(side);
      bumpWobble();

      if (side === "rise") {
        setMyRise((r) => r + unit);
        setMyFall(0);
        setMySide("rise");
      } else {
        setMyFall((f) => f + unit);
        setMyRise(0);
        setMySide("fall");
      }
    },
    [bumpWobble, phase, spawnFly, unit, walletLeft],
  );

  const undo = () => {
    if (mySide === "rise" && myRise >= unit) setMyRise((r) => r - unit);
    else if (mySide === "fall" && myFall >= unit) setMyFall((f) => f - unit);
  };

  const reset = () => {
    setMyRise(0);
    setMyFall(0);
    setPhase("bet");
  };

  const playWin = () => {
    if (myBet === 0) return;
    setPhase("win");
    setShake(true);
    window.setTimeout(() => setShake(false), 900);
  };

  const playLose = () => {
    if (myBet === 0) return;
    setPhase("lose");
    setShake(true);
    window.setTimeout(() => setShake(false), 900);
  };

  const myShare =
    mySide === "rise" ? myRise / Math.max(1, riseWeight) : myFall / Math.max(1, fallWeight);
  const loot = mySide === "rise" ? CROWD_FALL : CROWD_RISE;
  const gain = Math.round(loot * myShare);

  return (
    <div
      className={`relative rounded-3xl border-[3px] border-amber-600/70 bg-gradient-to-b from-[#1c1408] via-[#12100c] to-[#0a0a0a] overflow-hidden shadow-[inset_0_2px_0_rgba(255,220,120,.25),inset_0_-4px_0_rgba(0,0,0,.55)] ${
        shake ? "balance-scale-shake" : ""
      }`}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 balance-scale-scanlines opacity-[0.07]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-400/[0.06] via-transparent to-violet-600/[0.04]" aria-hidden />

      <div className="relative flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-700/40 via-amber-500/20 to-amber-700/40 border-b-2 border-amber-500/40">
        <span className="text-base sm:text-lg font-black text-amber-100 tracking-wide drop-shadow-[0_1px_0_rgba(0,0,0,.8)]">
          기운 저울 · 칩 걸기
        </span>
        <span className="text-xs sm:text-sm font-bold text-amber-200/80 tabular-nums">
          지갑 <ChipAmount amount={walletLeft} compact className="text-amber-200" />
        </span>
      </div>

      <div className="relative px-3 sm:px-5 py-4 sm:py-5 space-y-4">
        {/* 단위 선택 — 플래시식 칩 버튼 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm font-bold text-amber-200/70 mr-1">단위</span>
          {BET_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`min-w-[3.25rem] px-3 py-2 rounded-lg text-sm font-black tabular-nums transition-all active:translate-y-0.5 ${
                unit === u
                  ? "bg-gradient-to-b from-amber-300 to-amber-600 text-[#1a1008] shadow-[0_4px_0_#92400e,inset_0_1px_0_rgba(255,255,255,.45)] scale-105"
                  : "bg-gradient-to-b from-[#2a2418] to-[#1a1610] text-amber-100/90 border border-amber-700/40 shadow-[0_3px_0_#0a0a0a]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* 저울 무대 — 받침대 고정, 빔+접시 한 덩어리로 회전 */}
        <div className="relative mx-auto w-full max-w-[360px] h-[272px] sm:h-[292px]">
          <div className="absolute left-1/2 bottom-3 -translate-x-1/2 w-16 h-4 rounded-sm bg-[#2a2a2a] border border-[#444]" />
          <div
            className={`absolute left-1/2 bottom-7 -translate-x-1/2 w-2.5 h-[108px] sm:h-[118px] rounded-sm bg-gradient-to-r from-[#4a4a4a] via-[#9ca3af] to-[#4a4a4a] ${
              wobble ? "balance-scale-wobble" : ""
            }`}
            style={{ transformOrigin: "bottom center" }}
          />

          <div className="absolute left-1/2 top-[74px] sm:top-[78px] -translate-x-1/2 z-20 w-5 h-5 rounded-full border-2 border-amber-200 bg-amber-500 shadow-[0_0_0_2px_#1a1008]" />

          <div
            className="absolute left-1/2 top-[84px] sm:top-[88px] w-[min(100%,300px)] -translate-x-1/2"
            style={{
              transform: `translateX(-50%) rotate(${displayTilt}deg)`,
              transformOrigin: "center top",
            }}
          >
            <div className="h-3 w-full rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-800 shadow-[0_2px_0_#fde68a,inset_0_-1px_0_#78350f]" />

            <button
              type="button"
              disabled={walletLeft < unit}
              onClick={() => addToPan("fall")}
              className={`absolute left-0 top-2 flex w-[124px] sm:w-[132px] flex-col items-center disabled:opacity-50 active:scale-[0.97] ${
                mySide === "fall" && myBet > 0 ? "balance-pan-glow-blue" : ""
              }`}
              style={{ transform: "translateX(-50%)" }}
            >
              <div className="w-0.5 h-9 sm:h-10 bg-amber-900/70" />
              <div className="relative w-[108px] sm:w-[116px]">
                <div className="h-11 sm:h-12 rounded-[50%] border-2 border-blue-400/70 bg-gradient-to-b from-blue-950/80 to-[#0a1020] shadow-[0_5px_0_#1e3a5f,inset_0_2px_6px_rgba(96,165,250,.12)]" />
                <div className="absolute inset-x-3 bottom-3 top-4 flex items-end justify-center">
                  <div
                    className="w-12 sm:w-14 rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 balance-coin-stack-pulse transition-all duration-300"
                    style={{ height: `${stackHeightPct(fallWeight, maxStack)}%`, minHeight: 8 }}
                  />
                </div>
              </div>
              <span className="mt-1 text-sm font-black text-blue-300">하락</span>
              <span className="text-[11px] font-bold text-blue-200/75 tabular-nums">{fallWeight.toLocaleString()}</span>
            </button>

            <button
              type="button"
              disabled={walletLeft < unit}
              onClick={() => addToPan("rise")}
              className={`absolute right-0 top-2 flex w-[124px] sm:w-[132px] flex-col items-center disabled:opacity-50 active:scale-[0.97] ${
                mySide === "rise" && myBet > 0 ? "balance-pan-glow-red" : ""
              }`}
              style={{ transform: "translateX(50%)" }}
            >
              <div className="w-0.5 h-9 sm:h-10 bg-amber-900/70" />
              <div className="relative w-[108px] sm:w-[116px]">
                <div className="h-11 sm:h-12 rounded-[50%] border-2 border-red-400/70 bg-gradient-to-b from-red-950/80 to-[#1a0808] shadow-[0_5px_0_#7f1d1d,inset_0_2px_6px_rgba(248,113,113,.12)]" />
                <div className="absolute inset-x-3 bottom-3 top-4 flex items-end justify-center">
                  <div
                    className="w-12 sm:w-14 rounded-t-md bg-gradient-to-t from-red-800 to-red-400 balance-coin-stack-pulse transition-all duration-300"
                    style={{ height: `${stackHeightPct(riseWeight, maxStack)}%`, minHeight: 8 }}
                  />
                </div>
              </div>
              <span className="mt-1 text-sm font-black text-red-300">상승</span>
              <span className="text-[11px] font-bold text-red-200/75 tabular-nums">{riseWeight.toLocaleString()}</span>
            </button>
          </div>

          {flyCoins.map((c) => (
            <div
              key={c.id}
              className={`absolute left-1/2 top-[52px] w-7 h-7 -ml-3.5 rounded-full border-2 border-amber-200/80 bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_2px_0_#92400e] balance-coin-fly z-30 ${
                c.side === "rise" ? "balance-coin-fly-rise" : "balance-coin-fly-fall"
              }`}
            />
          ))}

          {phase === "win" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
              <div className="balance-win-burst text-4xl sm:text-5xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,.8)]">
                +{gain}
              </div>
            </div>
          )}
          {phase === "lose" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
              <div className="balance-lose-sink text-3xl sm:text-4xl font-black text-gray-500">−{myBet}</div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-amber-100/75 font-medium">
          접시를 누를 때마다 <strong className="text-amber-200">{unit}칩</strong>이 쌓이고 저울이 기울어져요
        </p>

        {/* 상태 바 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[#333] bg-[#0f0f0f]/90 px-2 py-2">
            <p className="text-[10px] text-gray-500 font-bold">내 배팅</p>
            <p className="text-base font-black text-white tabular-nums">{myBet || "—"}</p>
          </div>
          <div className="rounded-xl border border-[#333] bg-[#0f0f0f]/90 px-2 py-2">
            <p className="text-[10px] text-gray-500 font-bold">예측</p>
            <p className={`text-base font-black ${myBet ? (mySide === "rise" ? "text-red-400" : "text-blue-400") : "text-gray-600"}`}>
              {myBet ? (mySide === "rise" ? "상승" : "하락") : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[#333] bg-[#0f0f0f]/90 px-2 py-2">
            <p className="text-[10px] text-gray-500 font-bold">적중 시</p>
            <p className="text-base font-black text-green-400 tabular-nums">
              {myBet ? myBet + gain : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={myBet < unit}
            onClick={undo}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-[#252525] border border-[#444] text-white/90 active:scale-95"
          >
            한 번 취소
          </button>
          <button
            type="button"
            disabled={myBet === 0}
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-[#252525] border border-[#444] text-white/90 active:scale-95"
          >
            전부 치우기
          </button>
          <button
            type="button"
            disabled={myBet === 0}
            onClick={playWin}
            className="px-4 py-2 rounded-lg text-sm font-black bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_3px_0_#14532d] active:translate-y-0.5"
          >
            적중 연출
          </button>
          <button
            type="button"
            disabled={myBet === 0}
            onClick={playLose}
            className="px-4 py-2 rounded-lg text-sm font-black bg-gradient-to-b from-gray-600 to-gray-800 text-white shadow-[0_3px_0_#111] active:translate-y-0.5"
          >
            미적중 연출
          </button>
        </div>
      </div>
    </div>
  );
}
