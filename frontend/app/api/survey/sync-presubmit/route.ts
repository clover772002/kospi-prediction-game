import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";

  try {
    const upstream = await fetch(`${BACKEND}/api/survey/sync-presubmit`, {
      method: "POST",
      headers: {
        Authorization: auth,
      },
    });

    const data = await upstream.text();
    return new NextResponse(
      upstream.ok ? data : JSON.stringify({ detail: `[${upstream.status}] ${data}` }),
      {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { detail: `프록시 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
