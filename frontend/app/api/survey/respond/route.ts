import { NextRequest, NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const body = await req.text();

  try {
    const upstream = await fetch(`${BACKEND}/api/survey/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body,
    });

    const data = await upstream.text();
    // 디버그: 응답 상태와 바디를 그대로 반환
    return new NextResponse(
      upstream.ok ? data : JSON.stringify({ detail: `[${upstream.status}] ${data}` }),
      {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { detail: `프록시 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
