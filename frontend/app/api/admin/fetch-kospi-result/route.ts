import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel에서 실행 → Yahoo Finance 접근 가능 (Railway IP 제한 없음)
// Railway job_15_35가 이 엔드포인트를 호출해 KOSPI 결과를 Supabase에 저장

/** 한국 시간대 달력 기준 YYYY-MM-DD (toLocaleString 파싱 버그 방지) */
function todayKST(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setTime(d.getTime() + offsetDays * 86400000);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function POST(req: NextRequest) {
  // 간단한 시크릿 보호
  const secret = req.headers.get("x-admin-secret") ?? "";
  const expectedSecret = process.env.ADMIN_SECRET ?? "kospi-admin-2026";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) 네이버 파이낸스 우선 (한국 기준 전일 대비 등락률이 정확)
    let price: number | null = null;
    let changePct: number | null = null;
    let isUp: boolean | null = null;

    try {
      const naverRes = await fetch(
        "https://m.stock.naver.com/api/index/KOSPI/basic",
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)" },
          cache: "no-store",
        }
      );
      if (naverRes.ok) {
        const d = await naverRes.json();
        const priceStr = (d.closePrice ?? "").replace(/,/g, "");
        const ratioStr = (d.fluctuationsRatio ?? "").replace(/,/g, "");
        const code     = d.compareToPreviousPrice?.code ?? "";
        if (priceStr && ratioStr) {
          price     = Number(priceStr);
          changePct = Math.round(Number(ratioStr) * 100) / 100;
          isUp      = code === "2"; // 2=상승, 5=하락
        }
      }
    } catch { /* 네이버 실패 시 Yahoo로 fallback */ }

    // 2) 네이버 실패 시 Yahoo Finance fallback
    if (price === null) {
      const res = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=5d",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: `Yahoo Finance HTTP ${res.status}` },
          { status: 500 }
        );
      }
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) {
        return NextResponse.json({ error: "no meta in response" }, { status: 500 });
      }
      // Yahoo는 한국 공휴일 고려 없이 previousClose 계산하므로
      // regularMarketChangePercent 를 직접 사용
      price     = Number(meta.regularMarketPrice);
      changePct = Math.round((meta.regularMarketChangePercent ?? 0) * 100) / 100;
      isUp      = (changePct ?? 0) > 0;
    }

    if (!price || changePct === null || isUp === null) {
      return NextResponse.json({ error: "price data missing" }, { status: 500 });
    }

    // 2) Supabase에 직접 저장 (service role key 사용)
    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseService =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseService);
    const today    = todayKST();

    const { error: dbErr } = await supabase
      .from("daily_surveys")
      .update({
        kospi_result:     isUp,
        kospi_change_pct: changePct,
        is_closed:        true,
      })
      .eq("survey_date", today);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    // 3) 당일 참여자 정확도도 업데이트
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("user_id, kospi_answer")
      .eq("survey_date", today);

    if (responses?.length) {
      for (const r of responses) {
        await supabase
          .from("accuracy_records")
          .upsert(
            {
              user_id:       r.user_id,
              survey_date:   today,
              kospi_correct: r.kospi_answer === isUp,
            },
            { onConflict: "user_id,survey_date" }
          );
      }
    }

    return NextResponse.json({
      ok: true,
      date: today,
      price,
      changePct,
      isUp,
      participants: responses?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
