import { NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/api/public/kospi-chart`, {
      cache: "no-store",
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
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
