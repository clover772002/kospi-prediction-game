"use client";

import { useEffect, useState } from "react";

interface Candle {
  time: string;
  close: number;
  open: number;
  high: number;
  low: number;
}

export default function KospiChart() {
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch("/api/public/kospi-chart", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setData(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [retry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-500 text-sm">
        <span className="animate-pulse">차트 불러오는 중...</span>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-36 gap-2 text-gray-500 text-sm">
        <span>장 시작 전이거나 데이터를 불러올 수 없어요</span>
        <button
          onClick={() => setRetry((r) => r + 1)}
          className="text-xs px-3 py-1 rounded-full border border-gray-600 hover:border-gray-400 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  /* ── SVG 파라미터 ── */
  const W = 360;
  const H = 140;
  const PAD = { top: 12, right: 12, bottom: 22, left: 52 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const closes = data.map((d) => d.close);
  const highs  = data.map((d) => d.high);
  const lows   = data.map((d) => d.low);
  const minV = Math.min(...lows)   * 0.9995;
  const maxV = Math.max(...highs)  * 1.0005;
  const range = maxV - minV || 1;

  const xScale = (i: number) => (i / (data.length - 1)) * cW;
  const yScale = (v: number) => cH - ((v - minV) / range) * cH;

  const linePoints = data.map((d, i) => `${xScale(i)},${yScale(d.close)}`).join(" ");
  const firstClose = closes[0];
  const lastClose  = closes[closes.length - 1];
  const isUp = lastClose >= firstClose;
  const lineColor = isUp ? "#4ade80" : "#f87171";
  const changePct = (((lastClose - firstClose) / firstClose) * 100).toFixed(2);

  /* y축 눈금 4개 */
  const yTicks = [0, 1/3, 2/3, 1].map((t) => minV + t * range);

  /* x축 눈금: 최대 5개 */
  const xStep = Math.max(1, Math.floor(data.length / 4));
  const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1);

  return (
    <div className="px-1 pb-2">
      {/* 헤더 */}
      <div className="flex items-baseline justify-between mb-2 px-2">
        <span className="text-xs font-medium text-gray-400">KOSPI 오늘</span>
        <span className={`text-sm font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
          {lastClose.toLocaleString()}{" "}
          <span className="text-xs font-normal">
            ({isUp ? "+" : ""}{changePct}%)
          </span>
        </span>
      </div>

      {/* SVG 차트 */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 140, display: "block" }}
      >
        <defs>
          <linearGradient id="kg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* 가로 그리드 */}
          {yTicks.map((v, i) => (
            <line
              key={i}
              x1={0} x2={cW}
              y1={yScale(v)} y2={yScale(v)}
              stroke="#ffffff0a" strokeWidth={1}
            />
          ))}

          {/* 채우기 */}
          <polygon
            points={`0,${cH} ${linePoints} ${xScale(data.length - 1)},${cH}`}
            fill="url(#kg-fill)"
          />

          {/* 선 */}
          <polyline
            points={linePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 최신가 점 */}
          <circle
            cx={xScale(data.length - 1)}
            cy={yScale(lastClose)}
            r={3.5}
            fill={lineColor}
          />
          {/* 점 펄스 */}
          <circle
            cx={xScale(data.length - 1)}
            cy={yScale(lastClose)}
            r={6}
            fill={lineColor}
            opacity={0.25}
            style={{ animation: "ping 1.4s ease-out infinite" }}
          />

          {/* y축 레이블 */}
          {yTicks.map((v, i) => (
            <text
              key={i}
              x={-5}
              y={yScale(v) + 4}
              textAnchor="end"
              fontSize={8.5}
              fill="#666"
            >
              {Math.round(v).toLocaleString()}
            </text>
          ))}

          {/* x축 레이블 */}
          {xTicks.map((d) => {
            const idx = data.indexOf(d);
            return (
              <text
                key={d.time}
                x={xScale(idx)}
                y={cH + 14}
                textAnchor="middle"
                fontSize={8.5}
                fill="#555"
              >
                {d.time}
              </text>
            );
          })}
        </g>
      </svg>

      <p className="text-center text-[10px] text-gray-600 mt-1">
        KOSPI 1시간봉 · 실시간
      </p>
    </div>
  );
}
