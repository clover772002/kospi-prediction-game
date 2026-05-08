import { NextResponse } from "next/server";

const BACKEND = "https://kospi-prediction-game-production.up.railway.app";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/public/kospi-price`, {
      cache: "no-store",
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { price: null, change: null, change_pct: null, is_up: null, code: "" },
      { status: 200 }
    );
  }
}
