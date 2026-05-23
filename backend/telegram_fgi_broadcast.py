# -*- coding: utf-8 -*-
"""공포·탐욕 지수 집계 알림 — 웹 푸시(주) + 텔레그램 DM(연동자만·선택)."""
from __future__ import annotations

import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from fear_greed_fetch import FgiReading, fetch_all_fgi_readings
from krx_calendar import KST, next_trading_day_str
from telegram_bot import send_message
from webpush_helper import send_web_push_to_all

logger = logging.getLogger(__name__)


def today_kst() -> str:
    return datetime.now(KST).date().isoformat()


def _app_base_url() -> str:
    return (os.getenv("PUBLIC_APP_URL") or "https://kospi-prediction-game.vercel.app").rstrip("/")


def _fmt_score(score: float | int | None) -> str:
    if score is None:
        return "—"
    if float(score) == int(score):
        return str(int(score))
    return str(round(float(score), 1))


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
    body = f"{_fmt_score(r.score)} · {r.zone}" if r.score is not None else "—"
    src = _link(r.url, r.source)
    extra = ""
    if r.note == "조회 실패":
        extra = " <i>(조회 실패)</i>"
    elif r.note and r.note not in ("조회 실패", ""):
        extra = f" <i>({r.note})</i>"
    return f"{r.market} {src}\n   {body}{extra}"


def human_indicator_snapshot(supabase) -> dict:
    """인간지표: 실제 설문 응답만 집계(패딩 없음)."""
    base = _app_base_url()
    survey_url = f"{base}/survey?src=fgi_push"
    home_url = f"{base}/?src=fgi_push"

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

    if total > 0:
        up_pct = round(up / total * 100, 1)
        down_pct = round(100 - up_pct, 1)
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


def build_fgi_push_summary(readings: list[FgiReading], human: dict) -> tuple[str, str]:
    """웹 푸시용 짧은 제목·본문."""
    parts: list[str] = []
    for r in readings:
        if r.score is None:
            continue
        tag = r.source.replace("FearGreedChart", "FGC").replace("Alternative.me", "코인")
        if "KOSPI FGI" in r.source:
            tag = "KOSPIFGI"
        parts.append(f"{tag}{_fmt_score(r.score)}")

    machine = " · ".join(parts[:6]) if parts else "지표 조회 중"

    if human["up_pct"] is not None:
        human_bit = (
            f"인간지표 상승{human['up_pct']}%·하락{human['down_pct']}% "
            f"({human['phase']} {human['total']}명)"
        )
    else:
        human_bit = f"인간지표 ({human['phase']} · 응답 {human['total']}명)"

    body = f"{machine}\n{human_bit} — 탭하면 상세"
    if len(body) > 220:
        body = body[:217] + "…"
    return "📊 공포·탐욕 지수", body


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
    machine += "\n\n<i>※ 코스피 숫자는 출처마다 산식이 달라 다를 수 있습니다.</i>"

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


async def _broadcast_fgi_telegram_dm(supabase, text: str, markup: dict) -> dict:
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
    sent = failed = 0
    for chat_id in chat_ids:
        try:
            result = await send_message(chat_id, text, markup)
            if result.get("ok"):
                sent += 1
            else:
                failed += 1
                logger.warning("FGI 텔레그램 DM 실패 chat_id=%s: %s", chat_id, result)
        except Exception as e:
            failed += 1
            logger.error("FGI 텔레그램 DM 예외 chat_id=%s: %s", chat_id, e)
    return {"sent": sent, "failed": failed, "total": len(chat_ids)}


async def broadcast_fgi_digest(supabase) -> dict:
    """
    1) 브라우저 알림 연동 유저 전원 (push_subscription)
    2) 텔레그램 chat_id 있는 유저에게 DM (웹에서 연동 UI 제거돼도 기존 연동자용)
    """
    readings = await fetch_all_fgi_readings()
    human = human_indicator_snapshot(supabase)
    title, push_body = build_fgi_push_summary(readings, human)

    push_sent = await send_web_push_to_all(
        supabase,
        title,
        push_body,
        human["survey_url"],
        notif_type="fgi_digest",
    )

    tg = {"sent": 0, "failed": 0, "total": 0}
    if (os.getenv("FGI_TELEGRAM_DM", "1").strip().lower() not in ("0", "false", "no")):
        html = build_fgi_broadcast_html(readings, human)
        tg = await _broadcast_fgi_telegram_dm(supabase, html, _fgi_survey_link_markup())

    ok = push_sent > 0 or tg["sent"] > 0
    logger.info(
        "FGI 발송: 웹푸시 %s명, 텔레그램 %s/%s명",
        push_sent,
        tg["sent"],
        tg["total"],
    )
    return {
        "ok": ok,
        "push_sent": push_sent,
        "telegram_sent": tg["sent"],
        "telegram_failed": tg["failed"],
        "telegram_total": tg["total"],
        "readings_count": len(readings),
        "human": human,
    }
