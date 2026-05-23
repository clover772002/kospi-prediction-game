# -*- coding: utf-8 -*-
"""Profitchat(텔레그램) 관리자 DM — 상승%·참여 수만 받아 설문 시드."""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import HTTPException
from krx_calendar import next_trading_day_str
from supabase import Client

from admin_seed_responses import clear_seed_responses, seed_survey_from_admin_simple
from telegram_bot import send_message

logger = logging.getLogger(__name__)

_pending: dict[int, str] = {}


def admin_chat_ids() -> set[int]:
    raw = (
        os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "")
        or os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
        or ""
    )
    out: set[int] = set()
    for part in raw.replace(" ", "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.add(int(part))
        except ValueError:
            continue
    return out


def is_admin_chat(chat_id: int) -> bool:
    return chat_id in admin_chat_ids()


def _bot_label() -> str:
    return os.getenv("TELEGRAM_BOT_USERNAME", "Profitchat123bot").lstrip("@")


def _help_text() -> str:
    bot = _bot_label()
    return (
        f"<b>📊 관리자 설문 시드</b> (@{bot})\n\n"
        "<b>/poll ask</b> — 상승 %·참여 인원 물어봄 (다음 거래일)\n"
        "<b>/poll ask 2026-05-23</b> — 날짜 지정\n"
        "<b>/poll clear</b> — 시드 봇 응답 삭제\n"
        "<b>/poll cancel</b> — 입력 대기 취소\n\n"
        "답장 (한 줄이면 됨):\n"
        "<code>62 1284</code>\n"
        "→ 상승 62%, 1284명 참여로 해석\n\n"
        "미리보기: 맨 앞 <code>테스트</code>"
    )


async def request_poll_input(
    chat_id: int,
    survey_date: str | None = None,
) -> None:
    d = (survey_date or next_trading_day_str()).strip()[:10]
    _pending[chat_id] = d
    await send_message(
        chat_id,
        f"📊 <b>{d}</b> 외부 설문(블라인드 등) 반영\n\n"
        f"두 가지만 답장해 주세요.\n"
        f"① <b>상승 몇 %</b>\n"
        f"② <b>몇 명</b> 참여했는지\n\n"
        f"예) <code>62 1284</code>\n"
        f"또는\n"
        f"<code>62%</code>\n"
        f"<code>1284명</code>\n\n"
        f"확신도는 서버에서 랜덤으로 넣습니다.\n"
        f"취소: /poll cancel",
    )


async def notify_all_admins_poll_request(survey_date: str | None = None) -> int:
    ids = admin_chat_ids()
    if not ids:
        logger.warning("TELEGRAM_ADMIN_CHAT_ID(S) 미설정 — 관리자 투표 요청 생략")
        return 0
    for cid in ids:
        try:
            await request_poll_input(cid, survey_date)
        except Exception as e:
            logger.error("관리자 poll 요청 실패 chat_id=%s: %s", cid, e)
    return len(ids)


def _format_seed_result(result: dict[str, Any]) -> str:
    parsed = result.get("parsed") or {}
    seeded = result.get("seeded") or {}
    lines = [
        "✅ <b>설문 반영 완료</b>" if not result.get("dry_run") else "🔍 <b>미리보기</b>",
        f"거래일: <b>{result.get('survey_date')}</b>",
        f"입력: 상승 <b>{parsed.get('up_pct', '?')}%</b> · 참여 <b>{parsed.get('total_votes', '?')}</b>명",
        f"시드: <b>{seeded.get('total', result.get('created'))}</b>건 "
        f"(상승 {seeded.get('up', '?')} / 하락 {seeded.get('down', '?')})",
    ]
    if seeded.get("scaled_from_blind"):
        lines.append(f"※ 참여 수가 많아 최대 {seeded.get('total')}명까지 비율 유지·축소")
    lines.append(f"앱 집계(해당일): <b>{result.get('total_responses_after', '?')}</b>명")
    if result.get("failed"):
        lines.append(f"⚠️ 실패 {result['failed']}건")
    return "\n".join(lines)


async def handle_poll_command(
    chat_id: int,
    text: str,
    supabase: Client,
) -> bool:
    if not is_admin_chat(chat_id):
        return False

    parts = text.strip().split()
    if not parts:
        await send_message(chat_id, _help_text())
        return True

    if parts[0].lower().startswith("/poll@"):
        parts = ["/poll", *parts[1:]]

    if parts[0].lower() == "/poll" and len(parts) == 1:
        await send_message(chat_id, _help_text())
        return True

    sub = parts[1].lower() if len(parts) > 1 else "help"

    if sub in ("help", "도움", "?"):
        await send_message(chat_id, _help_text())
        return True

    if sub in ("ask", "요청", "request"):
        sd = parts[2][:10] if len(parts) > 2 else None
        await request_poll_input(chat_id, sd)
        return True

    if sub in ("cancel", "취소"):
        _pending.pop(chat_id, None)
        await send_message(chat_id, "취소했습니다.")
        return True

    if sub in ("clear", "삭제", "reset"):
        sd = parts[2][:10] if len(parts) > 2 else next_trading_day_str()
        out = clear_seed_responses(supabase, sd)
        await send_message(
            chat_id,
            f"🗑 <b>{sd}</b> 시드 삭제 · 봇 {out.get('seed_users_found', 0)}명",
        )
        return True

    await send_message(chat_id, _help_text())
    return True


async def handle_poll_reply(
    chat_id: int,
    text: str,
    supabase: Client,
) -> bool:
    if not is_admin_chat(chat_id):
        return False
    survey_date = _pending.get(chat_id)
    if not survey_date:
        return False

    body = text.strip()
    dry_run = False
    if body.lower().startswith("테스트") or body.lower().startswith("test"):
        dry_run = True
        body = body.split("\n", 1)[-1].strip() if "\n" in body else body[5:].strip()

    if not body:
        await send_message(chat_id, "숫자를 보내주세요. 예: 62 1284")
        return True

    try:
        result = seed_survey_from_admin_simple(
            supabase,
            survey_date,
            body,
            dry_run=dry_run,
            force=False,
        )
        if not dry_run:
            _pending.pop(chat_id, None)
        await send_message(chat_id, _format_seed_result(result))
    except HTTPException as e:
        await send_message(
            chat_id,
            f"❌ {e.detail}\n\n다시 보내거나 /poll cancel",
        )
    except Exception as e:
        logger.exception("telegram poll seed 실패")
        await send_message(chat_id, f"❌ 오류: {e}")

    return True
