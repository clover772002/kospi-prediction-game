import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel에서 실행 → Yahoo Finance 접근 가능 (Railway IP 제한 없음)
// Railway job_15_35가 이 엔드포인트를 호출해 KOSPI 결과를 Supabase에 저장

function todayKST(offsetDays = 0): string {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  // 간단한 시크릿 보호
  const secret = req.headers.get("x-admin-secret") ?? "";
  const expectedSecret = process.env.ADMIN_SECRET ?? "kospi-admin-2026";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Yahoo Finance에서 KOSPI 데이터 가져오기
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=5d",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
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

    const price     = Number(meta.regularMarketPrice);
    const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose);

    if (!price || !prevClose) {
      return NextResponse.json(
        { error: "price data missing", meta },
        { status: 500 }
      );
    }

    const changePct = Math.round(((price / prevClose - 1) * 100) * 100) / 100;
    const isUp      = price > prevClose;

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
      prevClose,
      changePct,
      isUp,
      participants: responses?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
