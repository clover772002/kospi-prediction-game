# -*- coding: utf-8 -*-
"""공포·탐욕 지수 — 웹 푸시(스케줄) + 텔레그램 봇은 물으면 답변(연동 불필요)."""
from __future__ import annotations

import asyncio
import html as html_module
import logging
import os
import re
import time
from datetime import datetime
from urllib.parse import urlparse
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
# 채팅 키워드 (띄어쓰기 제거 후 비교 포함)
_FGI_SHORT_TRIGGERS = frozenset({
    "공포", "지수", "탐욕",
    "공포지수", "탐욕지수", "공포탐욕", "공포탐욕지수",
    "fgi",
})


def today_kst() -> str:
    return datetime.now(KST).date().isoformat()


def _app_base_url() -> str:
    """텔레그램 DM 본문용 — vercel(웹)만, t.me 등은 사용 안 함."""
    default = "https://kospi-prediction-game.vercel.app"
    raw = (os.getenv("PUBLIC_APP_URL") or default).rstrip("/")
    low = raw.lower()
    if "t.me" in low or "telegram." in low:
        logger.warning("PUBLIC_APP_URL이 텔레그램 주소라 기본 vercel URL 사용: %s", raw)
        return default
    return raw


def _html_esc(text: str) -> str:
    return html_module.escape(str(text), quote=False)


def _html_url(url: str) -> str:
    return str(url).replace("&", "&amp;")


def _fmt_score(score: float | int | None) -> str:
    if score is None:
        return "—"
    if float(score) == int(score):
        return str(int(score))
    return str(round(float(score), 1))


def _market_short_name(market: str) -> str:
    """🇰🇷 코스피 → 코스피"""
    s = re.sub(
        r"^[\s\U0001F1E0-\U0001FFFF\U0001F300-\U0001FAFF]+",
        "",
        (market or "").strip(),
    )
    return s.strip() or market.strip()


def _is_kospi_reading(r: FgiReading) -> bool:
    return _market_short_name(r.market) == "코스피"


def _market_score_line(r: FgiReading) -> str:
    """코스피(31, 공포) FearGreedChart — 링크 없음(본문 URL은 vercel만)."""
    name = _html_esc(_market_short_name(r.market))
    if r.score is not None:
        return (
            f"{name}(<b>{_fmt_score(r.score)}</b>, {_html_esc(r.zone)}) "
            f"{_html_esc(r.source)}"
        )
    return f"{name}(—) {_html_esc(r.source)}"


def _human_score_line(human: dict, *, survey_src: str = "fgi") -> str:
    """코스피 투표 — 요약 한 줄 + vercel plain URL (메시지 내 유일한 링크)."""
    base = _app_base_url()
    survey_url = f"{base}/survey?src={survey_src}"
    host = urlparse(base).netloc or base.replace("https://", "").replace("http://", "")
    name = _html_esc("코스피 투표")
    if human["up_pct"] is not None:
        up, down = human["up_pct"], human["down_pct"]
        if up >= down:
            tag = f"상승 {_fmt_score(up)}%"
        else:
            tag = f"하락 {_fmt_score(down)}%"
        head = f"{name}(<b>{_html_esc(tag)}</b>) {_html_esc(host)}"
    else:
        head = f"{name}(—) {_html_esc(host)}"
    return f"{head}\n{_html_url(survey_url)}"


def _empty_human_snapshot() -> dict:
    base = _app_base_url()
    return {
        "survey_date": next_trading_day_str(),
        "status": "open",
        "phase": "—",
        "total": 0,
        "up_pct": None,
        "down_pct": None,
        "survey_url": f"{base}/survey?src=fgi_push",
        "home_url": f"{base}/?src=fgi_push",
    }


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


def human_indicator_snapshot_safe(supabase) -> dict:
    try:
        return human_indicator_snapshot(supabase)
    except Exception as e:
        logger.exception("인간지표 집계 실패(시장 지표만 전송): %s", e)
        return _empty_human_snapshot()


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
    survey_src: str = "fgi",
) -> str:
    now = as_of or datetime.now(KST)
    header = f"📊 <b>공포·탐욕 지수</b> ({now.strftime('%Y-%m-%d %H:%M')} KST)\n\n"

    kospi_blocks = [_market_score_line(r) for r in readings if _is_kospi_reading(r)]
    other_blocks = [_market_score_line(r) for r in readings if not _is_kospi_reading(r)]
    blocks = (
        kospi_blocks
        + [_human_score_line(human, survey_src=survey_src)]
        + other_blocks
    )

    market = "<b>🤖 시장 지표</b>\n"
    market += "\n\n".join(blocks)

    return header + market


def _normalize_telegram_text(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    t = re.sub(r"[\u200b\uFEFF]", "", t)
    if "@" in t and t.startswith("/"):
        t = t.split("@", 1)[0]
    return t.strip("?!.．。,，、 ")


def _compact_text(t: str) -> str:
    """띄어쓰기·제로폭 제거 — 「공포 지수」→「공포지수」와 동일 취급."""
    return re.sub(r"[\s\u200b\uFEFF]+", "", t)


def is_fgi_telegram_query(text: str) -> bool:
    """웹 연동 없이 봇에게 FGI를 요청했는지."""
    t = _normalize_telegram_text(text)
    if not t:
        return False
    compact = _compact_text(t)
    if t in _FGI_SHORT_TRIGGERS or compact in _FGI_SHORT_TRIGGERS:
        return True
    low = t.lower()
    compact_low = _compact_text(low)
    if low in _FGI_COMMANDS:
        return True
    if low.startswith("/fgi") or low.startswith("/지수") or low.startswith("/공포"):
        return True
    phrases = (
        "공포탐욕",
        "공포탐욕지수",
        "공포지수",
        "공포 지수",
        "탐욕지수",
        "fear and greed",
        "fear greed",
    )
    phrase_compact = tuple(_compact_text(p) for p in phrases)
    if any(p in compact_low for p in phrase_compact if p):
        return True
    if re.fullmatch(r"(fgi|f\s*&\s*g)", compact_low):
        return True
    return False


def _fgi_cache_is_fresh() -> bool:
    global _FGI_REPLY_CACHE
    if not _FGI_REPLY_CACHE:
        return False
    return time.time() - _FGI_REPLY_CACHE[0] < _FGI_CACHE_SEC


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
    human = await asyncio.to_thread(human_indicator_snapshot_safe, supabase)
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
            "<b>공포·탐욕 지수</b>\n\n"
            "· <b>공포</b> · <b>지수</b> · <b>공포지수</b>",
        )
        return True

    if not is_fgi_telegram_query(text):
        return False

    try:
        from telegram_bot import send_chat_action

        if not _fgi_cache_is_fresh():
            await send_chat_action(chat_id, "typing")
            await send_message(
                chat_id,
                "📊 <b>지표 수집 중</b>\n\n"
                "코스피·미국·코인 등 여러 곳에서 불러오고 있어요.\n"
                "잠시만 기다려 주세요…",
            )

        html = await build_fgi_reply_html(supabase)
        result = await send_message(chat_id, html)
        if not result.get("ok"):
            raise RuntimeError(result.get("description") or "sendMessage failed")
    except Exception as e:
        logger.exception("FGI 텔레그램 답변 실패: %s", e)
        await send_message(
            chat_id,
            "지표를 불러오지 못했어요. 1~2분 뒤 「공포」 또는 「지수」로 다시 시도해 주세요.",
        )
    return True


async def send_fgi_telegram_to_admins(supabase, *, force_refresh: bool = True) -> dict:
    """TELEGRAM_ADMIN_CHAT_ID(S) 관리자에게 FGI 답변과 동일한 DM 전송."""
    from telegram_admin_poll import admin_chat_ids
    from telegram_bot import send_message

    ids = admin_chat_ids()
    if not ids:
        return {"ok": False, "sent": 0, "error": "TELEGRAM_ADMIN_CHAT_ID(S) 미설정"}

    html = await build_fgi_reply_html(supabase, force_refresh=force_refresh)
    sent = 0
    errors: list[str] = []
    for cid in ids:
        result = await send_message(cid, html)
        if result.get("ok"):
            sent += 1
        else:
            errors.append(f"{cid}: {result.get('description', 'unknown')}")

    return {
        "ok": sent > 0,
        "sent": sent,
        "admins": sorted(ids),
        "errors": errors,
    }


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
