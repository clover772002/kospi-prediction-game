# -*- coding: utf-8 -*-
"""공포·탐욕 지수 — 웹 푸시(스케줄) + 텔레그램 봇은 물으면 답변(연동 불필요)."""
from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from fear_greed_fetch import FgiReading, fetch_all_fgi_readings
from krx_calendar import KST, next_trading_day_str
from webpush_helper import send_web_push_to_all

logger = logging.getLogger(__name__)

_FGI_REPLY_CACHE: tuple[float, str] | None = None
_FGI_CACHE_SEC = 300

_FGI_COMMANDS = frozenset({
    "/fgi", "/지수", "/공포", "/탐욕", "/fear", "/greed",
    "/help_fgi", "/fgi_help",
})


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


def _score_line(r: FgiReading) -> str:
    """수치 → 출처명 → URL(텔레그램이 URL을 바로 탭 가능하게 노출)."""
    if r.score is not None:
        score_part = f"<b>{_fmt_score(r.score)}</b> · {r.zone}"
    else:
        score_part = "—"
    note = ""
    if r.note == "조회 실패":
        note = "\n   <i>(조회 실패)</i>"
    elif r.note and r.note not in ("조회 실패", ""):
        note = f"\n   <i>({r.note})</i>"
    return (
        f"{r.market}\n"
        f"   {score_part}\n"
        f"   {r.source}\n"
        f"   {r.url}{note}"
    )


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
        f"   {pct_line}\n"
        f"   {h['phase']} · {h['total']}명 · 거래일 {h['survey_date']}\n"
        f"   설문 참여\n"
        f"   {h['survey_url']}\n"
        f"   게임 소개\n"
        f"   {h['home_url']}"
    )

    return header + machine + human_block


def _normalize_telegram_text(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if "@" in t and t.startswith("/"):
        t = t.split("@", 1)[0]
    return t


def is_fgi_telegram_query(text: str) -> bool:
    """웹 연동 없이 봇에게 FGI를 요청했는지."""
    t = _normalize_telegram_text(text)
    if not t:
        return False
    low = t.lower()
    if low in _FGI_COMMANDS:
        return True
    if low.startswith("/fgi") or low.startswith("/지수"):
        return True
    phrases = (
        "공포탐욕",
        "공포 탐욕",
        "공포탐욕지수",
        "공포 지수",
        "fear and greed",
        "fear greed",
    )
    if any(p in low for p in phrases):
        return True
    if re.fullmatch(r"(fgi|f\s*&\s*g)", low):
        return True
    return False


async def build_fgi_reply_html(supabase, *, force_refresh: bool = False) -> str:
    global _FGI_REPLY_CACHE
    now = time.time()
    if (
        not force_refresh
        and _FGI_REPLY_CACHE
        and now - _FGI_REPLY_CACHE[0] < _FGI_CACHE_SEC
    ):
        return _FGI_REPLY_CACHE[1]

    readings = await fetch_all_fgi_readings()
    human = human_indicator_snapshot(supabase)
    html = build_fgi_broadcast_html(readings, human)
    _FGI_REPLY_CACHE = (now, html)
    return html


async def handle_telegram_fgi_message(chat_id: int | str, text: str, supabase) -> bool:
    """
    텔레그램 봇 DM: /fgi · 공포탐욕 등 → 집계 답변. 계정 연동(/start uuid) 불필요.
    """
    from telegram_bot import send_message

    t = _normalize_telegram_text(text)
    if t in ("/help_fgi", "/fgi_help"):
        await send_message(
            chat_id,
            "<b>공포·탐욕 지수 조회</b>\n\n"
            "명령: <code>/fgi</code> · <code>/지수</code>\n"
            "또는 채팅에 「공포탐욕」「공포 지수」라고 보내 주세요.\n\n"
            "<i>웹앱 연동 없이 봇만 써도 됩니다.</i>",
        )
        return True

    if not is_fgi_telegram_query(text):
        return False

    try:
        html = await build_fgi_reply_html(supabase)
        await send_message(chat_id, html, _fgi_survey_link_markup())
    except Exception as e:
        logger.exception("FGI 텔레그램 답변 실패: %s", e)
        await send_message(
            chat_id,
            "지표를 불러오지 못했어요. 1~2분 뒤 <code>/fgi</code> 로 다시 시도해 주세요.",
        )
    return True


async def broadcast_fgi_digest(supabase) -> dict:
    """16:10 스케줄 — 브라우저 알림 구독자에게만 짧은 웹 푸시."""
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

    logger.info("FGI 웹푸시 발송: %s명", push_sent)
    return {
        "ok": push_sent > 0,
        "push_sent": push_sent,
        "readings_count": len(readings),
        "human": human,
    }
