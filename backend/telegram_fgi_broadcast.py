# -*- coding: utf-8 -*-
"""텔레그램 FGI 집계 — 연동 유저 전원 DM (기존 Profitchat 봇·토큰)."""
from __future__ import annotations

import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from fear_greed_fetch import FgiReading, fetch_all_fgi_readings
from krx_calendar import next_trading_day_str


def today_kst() -> str:
    from datetime import datetime
    from krx_calendar import KST
    return datetime.now(KST).date().isoformat()
from telegram_bot import send_message

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")


def _app_base_url() -> str:
    return (os.getenv("PUBLIC_APP_URL") or "https://kospi-prediction-game.vercel.app").rstrip("/")


def _fgi_survey_link_markup() -> dict:
    url = f"{_app_base_url()}/survey?src=telegram_fgi"
    return {
        "inline_keyboard": [[
            {"text": "📊 웹 설문 열기 (슬라이더 · 1% 단위)", "url": url},
        ]],
    }


def _link(url: str, label: str) -> str:
    safe_url = url.replace('"', "%22")
    return f'<a href="{safe_url}">{label}</a>'


def _score_line(r: FgiReading) -> str:
    if r.score is None:
        body = "—"
    else:
        s = int(r.score) if float(r.score) == int(r.score) else round(float(r.score), 1)
        body = f"{s} · {r.zone}"
    src = _link(r.url, r.source)
    extra = f" <i>({r.note})</i>" if r.note and r.note not in ("조회 실패", "") else ""
    if r.note == "조회 실패":
        extra = " <i>(조회 실패)</i>"
    return f"{r.market} {src}\n   {body}{extra}"


def human_indicator_snapshot(supabase) -> dict:
    """
    인간지표: 실제 설문 응답만 집계(패딩 없음).
    우선 다음 거래일 설문(모집 중) → 없으면 오늘 설문.
    """
    base = _app_base_url()
    survey_url = f"{base}/survey?src=telegram_fgi"
    home_url = f"{base}/?src=telegram_fgi"

    candidates: list[tuple[str, str]] = []
    next_str = next_trading_day_str()
    today_str = today_kst()

    for sd in (next_str, today_str):
        if sd in [c[0] for c in candidates]:
            continue
        row = (
            supabase.table("daily_surveys")
            .select("survey_date, is_closed, kospi_result")
            .eq("survey_date", sd)
            .execute()
        )
        if not row.data:
            if sd == next_str:
                candidates.append((sd, "open"))
            continue
        rec = row.data[0]
        if rec.get("kospi_result") is not None:
            st = "result"
        elif rec.get("is_closed"):
            st = "closed"
        else:
            st = "open"
        candidates.append((sd, st))

    if not candidates:
        candidates.append((next_str, "open"))

    survey_date, status = candidates[0]
    resp = (
        supabase.table("survey_responses")
        .select("kospi_answer")
        .eq("survey_date", survey_date)
        .execute()
    )
    rows = resp.data or []
    total = len(rows)
    up = sum(1 for r in rows if r.get("kospi_answer"))
    down = total - up

    if total > 0:
        up_pct = round(up / total * 100, 1)
        down_pct = round(down / total * 100, 1)
    else:
        up_pct = down_pct = None

    if status == "open":
        phase = "모집 중"
    elif status == "closed":
        phase = "마감"
    else:
        phase = "결과 확정"

    return {
        "survey_date": survey_date,
        "status": status,
        "phase": phase,
        "total": total,
        "up_pct": up_pct,
        "down_pct": down_pct,
        "survey_url": survey_url,
        "home_url": home_url,
    }


def build_fgi_broadcast_html(
    readings: list[FgiReading],
    human: dict,
    *,
    as_of: datetime | None = None,
) -> str:
    now = as_of or datetime.now(KST)
    header = f"📊 <b>공포·탐욕 지수</b> ({now.strftime('%Y-%m-%d %H:%M')} KST)\n\n"

    machine = "<b>🤖 시장 지표</b>\n"
    machine += "\n".join(_score_line(r) for r in readings)
    machine += (
        "\n\n<i>※ 코스피 숫자는 출처마다 산식이 달라 다를 수 있습니다.</i>"
    )

    h = human
    if h["up_pct"] is not None:
        pct_line = f"상승 <b>{h['up_pct']}%</b> · 하락 <b>{h['down_pct']}%</b>"
    else:
        pct_line = "상승 · 하락 <i>(아직 응답 없음)</i>"

    human_block = (
        f"\n\n<b>👥 인간지표</b> — 코스피 예측 게임\n"
        f"{pct_line} ({h['phase']} · {h['total']}명)\n"
        f"대상 거래일 {h['survey_date']}\n"
        f"참여 {_link(h['survey_url'], '설문 참여하기')}\n"
        f"소개 {_link(h['home_url'], '게임 알아보기')}"
    )

    return header + machine + human_block


async def broadcast_fgi_digest(supabase) -> dict:
    """텔레그램 연동 유저 전원 DM (TELEGRAM_BOT_TOKEN, send_daily_survey와 동일 대상)."""
    readings = await fetch_all_fgi_readings()
    human = human_indicator_snapshot(supabase)
    text = build_fgi_broadcast_html(readings, human)
    markup = _fgi_survey_link_markup()

    users = (
        supabase.table("users")
        .select("telegram_chat_id")
        .not_.is_("telegram_chat_id", "null")
        .execute()
    )
    chat_ids = [
        u["telegram_chat_id"]
        for u in (users.data or [])
        if u.get("telegram_chat_id") is not None
    ]

    if not chat_ids:
        logger.info("FGI DM 발송: 텔레그램 연동 유저 없음")
        return {
            "ok": True,
            "sent": 0,
            "failed": 0,
            "total": 0,
            "readings_count": len(readings),
            "human": human,
        }

    sent = 0
    failed = 0
    for chat_id in chat_ids:
        try:
            result = await send_message(chat_id, text, markup)
            if result.get("ok"):
                sent += 1
            else:
                failed += 1
                logger.warning("FGI DM 실패 chat_id=%s: %s", chat_id, result)
        except Exception as e:
            failed += 1
            logger.error("FGI DM 예외 chat_id=%s: %s", chat_id, e)

    logger.info("FGI DM 발송 완료: %s/%s명 (실패 %s)", sent, len(chat_ids), failed)
    return {
        "ok": sent > 0,
        "sent": sent,
        "failed": failed,
        "total": len(chat_ids),
        "readings_count": len(readings),
        "human": human,
    }
