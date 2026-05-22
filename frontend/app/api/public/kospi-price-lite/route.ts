import { NextResponse } from "next/server";

/** 설문 탭용 — 종가·등락률 숫자만, Yahoo 단일 호출(약 3초 타임아웃) */
async function fetchYahooLite(): Promise<{
  price: number | null;
  change_pct: number | null;
  is_up: boolean | null;
} | null> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const meta = (await res.json())?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = Number(meta.regularMarketPrice) || null;
    const prev =
      Number(meta.chartPreviousClose ?? meta.previousClose) || null;
    const change_pct =
      price && prev
        ? Math.round((price / prev - 1) * 10000) / 100
        : null;
    const is_up = change_pct != null ? change_pct >= 0 : null;
    return { price, change_pct, is_up };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const yahoo = await fetchYahooLite();
  return NextResponse.json(
    yahoo ?? { price: null, change_pct: null, is_up: null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
