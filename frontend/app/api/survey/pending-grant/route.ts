import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const surveyDate = req.nextUrl.searchParams.get("survey_date");
  const url = surveyDate
    ? `${BACKEND}/api/survey/pending-grant?survey_date=${encodeURIComponent(surveyDate)}`
    : `${BACKEND}/api/survey/pending-grant`;
  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: auth },
    });
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { detail: `프록시 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
