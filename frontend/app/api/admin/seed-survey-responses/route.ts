import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://kospi-prediction-game-production.up.railway.app";

function checkSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret") ?? "";
  const expected = process.env.ADMIN_SECRET ?? "kospi-admin-2026";
  return secret === expected;
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const upstream = await fetch(`${BACKEND}/api/admin/seed-survey-responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": req.headers.get("x-admin-secret") ?? "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const surveyDate = req.nextUrl.searchParams.get("survey_date") ?? "";
  const q = surveyDate ? `?survey_date=${encodeURIComponent(surveyDate)}` : "";
  try {
    const upstream = await fetch(
      `${BACKEND}/api/admin/seed-survey-responses${q}`,
      {
        method: "DELETE",
        headers: {
          "x-admin-secret": req.headers.get("x-admin-secret") ?? "",
        },
        cache: "no-store",
      },
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
