import { NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

// Vercel에서 직접 Naver 호출 (Railway IP 제한 우회)
async function fetchNaverOhlc() {
  const res = await fetch("https://m.stock.naver.com/api/index/KOSPI/basic", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const d = await res.json();

  const num = (key: string) => {
    const v = (d[key] ?? "").replace(/,/g, "");
    return v ? Number(v) : null;
  };
  const code = d.compareToPreviousPrice?.code ?? "";
  return {
    price:      num("closePrice"),
    open:       num("openPrice"),
    high:       num("highPrice"),
    low:        num("lowPrice"),
    change_pct: num("fluctuationsRatio"),
    is_up:      code === "2",
    code,
    source:     "naver",
  };
}

// Railway DB에서 오늘 확정 등락률 가져오기
async function fetchDbResult() {
  try {
    const res = await fetch(`${BACKEND}/api/public/kospi-price`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [naver, db] = await Promise.allSettled([
      fetchNaverOhlc(),
      fetchDbResult(),
    ]);

    const naverData = naver.status === "fulfilled" ? naver.value : null;
    const dbData    = db.status   === "fulfilled" ? db.value   : null;

    // DB에 확정된 change_pct 있으면 우선 사용, OHLC는 Naver에서
    const result = {
      price:      naverData?.price      ?? null,
      open:       naverData?.open       ?? null,
      high:       naverData?.high       ?? null,
      low:        naverData?.low        ?? null,
      change_pct: dbData?.change_pct    ?? naverData?.change_pct ?? null,
      is_up:      dbData?.is_up         ?? naverData?.is_up      ?? null,
      code:       naverData?.code       ?? dbData?.code ?? "",
      source:     naverData ? "naver" : "db",
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (e) {
    return NextResponse.json(
      { price: null, open: null, high: null, low: null, change_pct: null, is_up: null, code: "" },
      { status: 200 }
    );
  }
}
