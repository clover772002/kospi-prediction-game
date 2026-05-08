import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 수동 보정용 엔드포인트
// POST body: { date, changePct, isUp }
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret") ?? "";
  if (secret !== (process.env.ADMIN_SECRET ?? "kospi-admin-2026")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { date, changePct, isUp } = body;

  if (!date || changePct === undefined || isUp === undefined) {
    return NextResponse.json({ error: "date, changePct, isUp required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase
    .from("daily_surveys")
    .update({ kospi_result: isUp, kospi_change_pct: changePct, is_closed: true })
    .eq("survey_date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 정확도 기록 업데이트
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("user_id, kospi_answer")
    .eq("survey_date", date);

  for (const r of responses ?? []) {
    await supabase.from("accuracy_records").upsert(
      { user_id: r.user_id, survey_date: date, kospi_correct: r.kospi_answer === isUp },
      { onConflict: "user_id,survey_date" }
    );
  }

  return NextResponse.json({ ok: true, date, changePct, isUp, participants: responses?.length ?? 0 });
}
