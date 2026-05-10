import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const body = await req.text();

  try {
    const upstream = await fetch(`${BACKEND}/api/consumables/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body,
    });

    const text = await upstream.text();
    return new NextResponse(
      upstream.ok ? text : JSON.stringify({ detail: `[${upstream.status}] ${text}` }),
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
