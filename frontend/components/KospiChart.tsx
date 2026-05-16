"use client";

import { useEffect, useState } from "react";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface DayOhlc {
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change_pct: number | null;
  is_up: boolean | null;
}

export default function KospiChart() {
  const [data, setData]       = useState<Candle[]>([]);
  const [ohlc, setOhlc]       = useState<DayOhlc | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry]     = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/public/kospi-chart", { cache: "no-store" })
        .then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/public/kospi-price", { cache: "no-store" })
        .then((r) => r.json()).catch(() => null),
    ]).then(([chartRes, priceRes]) => {
      setData(chartRes.data || []);
      setOhlc(priceRes);
      setLoading(false);
    });
  }, [retry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-500 text-sm">
        <span className="animate-pulse">차트 불러오는 중...</span>
      </div>
    );
  }

  /* ── 시간봉 데이터가 있으면 SVG 라인 차트 ── */
  if (data.length >= 2) {
    return <LineChart data={data} onRetry={() => setRetry((r) => r + 1)} />;
  }

  /* ── 스냅샷 없으면 일봉 OHLC 요약 ── */
  if (ohlc?.price && ohlc.open && ohlc.high && ohlc.low) {
    return <OhlcSummary ohlc={ohlc} onRetry={() => setRetry((r) => r + 1)} />;
  }

  /* ── 데이터 없음 ── */
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2 text-gray-500 text-sm text-center px-4">
      <span className="text-2xl">📊</span>
      <span>데이터를 불러올 수 없어요</span>
      <button
        onClick={() => setRetry((r) => r + 1)}
        className="text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-gray-500 transition-colors mt-1"
      >
        다시 시도
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* OHLC 일봉 요약 카드                                     */
/* ────────────────────────────────────────────────────── */
function OhlcSummary({ ohlc, onRetry }: { ohlc: DayOhlc; onRetry: () => void }) {
  const isUp  = ohlc.is_up ?? (ohlc.change_pct ?? 0) >= 0;
  const color = isUp ? "text-red-400" : "text-blue-400";
  const bg    = isUp ? "bg-red-500/10 border-red-500/20" : "bg-blue-500/10 border-blue-500/20";

  /* 고저 범위 바 */
  const rangeW = ohlc.high! - ohlc.low!;
  const closePct = rangeW > 0 ? ((ohlc.price! - ohlc.low!) / rangeW) * 100 : 50;
  const openPct  = rangeW > 0 ? ((ohlc.open!  - ohlc.low!) / rangeW) * 100 : 50;

  return (
    <div className="px-4 pb-4">
      {/* 헤더 */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">KOSPI 오늘 종가</span>
          <span className="text-[9px] text-gray-600 bg-[#222] px-1.5 py-0.5 rounded">장마감</span>
        </div>
        <span className={`text-sm font-bold ${color}`}>
          {ohlc.price!.toLocaleString()}
          {ohlc.change_pct !== null && (
            <span className="text-xs font-normal ml-1">
              ({isUp ? "+" : ""}{ohlc.change_pct!.toFixed(2)}%)
            </span>
          )}
        </span>
      </div>

      {/* OHLC 4칸 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "시가", val: ohlc.open },
          { label: "고가", val: ohlc.high, cls: "text-emerald-400" },
          { label: "저가", val: ohlc.low,  cls: "text-orange-400" },
          { label: "종가", val: ohlc.price, cls: color },
        ].map(({ label, val, cls }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] text-gray-600 mb-0.5">{label}</p>
            <p className={`text-xs font-bold tabular-nums ${cls ?? "text-white"}`}>
              {val?.toLocaleString() ?? "-"}
            </p>
          </div>
        ))}
      </div>

      {/* 고저 범위 바 */}
      <div className="relative h-4 bg-[#222] rounded-full overflow-hidden">
        {/* 고저 범위 */}
        <div
          className={`absolute top-0 h-full rounded-full ${isUp ? "bg-red-500/30" : "bg-blue-500/30"}`}
          style={{ left: 0, right: 0 }}
        />
        {/* 시가 마커 */}
        <div
          className="absolute top-1 h-2 w-0.5 bg-gray-400 rounded"
          style={{ left: `${openPct}%`, transform: "translateX(-50%)" }}
        />
        {/* 종가 마커 */}
        <div
          className={`absolute top-0.5 h-3 w-1 rounded ${isUp ? "bg-red-400" : "bg-blue-400"}`}
          style={{ left: `${closePct}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 mt-1">
        <span>저 {ohlc.low?.toLocaleString()}</span>
        <span>고 {ohlc.high?.toLocaleString()}</span>
      </div>

      <p className="text-center text-[10px] text-gray-600 mt-3">
        장 중 1시간봉은 내일 09:00부터 업데이트됩니다
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* 시간봉 라인 차트 (SVG)                                  */
/* ────────────────────────────────────────────────────── */
function LineChart({ data, onRetry }: { data: Candle[]; onRetry: () => void }) {
  const W = 360, H = 140;
  const PAD = { top: 12, right: 12, bottom: 22, left: 52 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;

  const closes = data.map((d) => d.close);
  const minV   = Math.min(...data.map((d) => d.low))  * 0.9995;
  const maxV   = Math.max(...data.map((d) => d.high)) * 1.0005;
  const range  = maxV - minV || 1;

  const xScale = (i: number) => (i / (data.length - 1)) * cW;
  const yScale = (v: number) => cH - ((v - minV) / range) * cH;

  const linePoints = data.map((d, i) => `${xScale(i)},${yScale(d.close)}`).join(" ");
  const last   = closes[closes.length - 1];
  const first  = closes[0];
  const isUp   = last >= first;
  const color  = isUp ? "#f87171" : "#60a5fa";
  const chgPct = (((last - first) / first) * 100).toFixed(2);

  const yTicks = [0, 1/3, 2/3, 1].map((t) => minV + t * range);
  const xStep  = Math.max(1, Math.floor(data.length / 4));
  const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1);

  return (
    <div className="px-1 pb-2">
      <div className="flex items-baseline justify-between mb-2 px-2">
        <span className="text-xs font-medium text-gray-400">KOSPI 오늘</span>
        <span className={`text-sm font-bold ${isUp ? "text-red-400" : "text-blue-400"}`}>
          {last.toLocaleString()}
          <span className="text-xs font-normal ml-1">({isUp ? "+" : ""}{chgPct}%)</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140, display: "block" }}>
        <defs>
          <linearGradient id="kg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {yTicks.map((v, i) => (
            <line key={i} x1={0} x2={cW} y1={yScale(v)} y2={yScale(v)} stroke="#ffffff0a" strokeWidth={1} />
          ))}
          <polygon points={`0,${cH} ${linePoints} ${xScale(data.length-1)},${cH}`} fill="url(#kg-fill)" />
          <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={xScale(data.length-1)} cy={yScale(last)} r={3.5} fill={color} />
          <circle cx={xScale(data.length-1)} cy={yScale(last)} r={6} fill={color} opacity={0.25}
            style={{ animation: "ping 1.4s ease-out infinite" }} />
          {yTicks.map((v, i) => (
            <text key={i} x={-5} y={yScale(v)+4} textAnchor="end" fontSize={8.5} fill="#555">
              {Math.round(v).toLocaleString()}
            </text>
          ))}
          {xTicks.map((d) => (
            <text key={d.time} x={xScale(data.indexOf(d))} y={cH+14} textAnchor="middle" fontSize={8.5} fill="#555">
              {d.time}
            </text>
          ))}
        </g>
      </svg>
      <p className="text-center text-[10px] text-gray-600 mt-1">KOSPI 1시간봉 · 30분 간격 갱신</p>
    </div>
  );
}
