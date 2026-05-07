import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  try {
    const upstream = await fetch(`${BACKEND}/api/survey/my-response`, {
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
