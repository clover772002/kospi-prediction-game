# -*- coding: utf-8 -*-
"""관리자 텔레그램 DM: 블라인드 등 외부 투표 수치 붙여넣기 → 설문 시드."""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import HTTPException
from krx_calendar import next_trading_day_str
from supabase import Client

from admin_seed_responses import (
    clear_seed_responses,
    seed_survey_from_blind_text,
)
from telegram_bot import send_message

logger = logging.getLogger(__name__)

# chat_id → 기다리는 survey_date (YYYY-MM-DD)
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


def _help_text() -> str:
    return (
        "<b>📊 외부 투표 → 설문 시드 (관리자)</b>\n\n"
        "<b>/poll ask</b> — 수치 붙여넣기 요청 (기본: 다음 거래일)\n"
        "<b>/poll ask 2026-05-23</b> — 날짜 지정\n"
        "<b>/poll clear</b> — 해당일 시드 봇 응답 삭제\n"
        "<b>/poll cancel</b> — 입력 대기 취소\n\n"
        "답장 예시:\n"
        "<code>상승 62%\n하락 38%\n1,284명 참여</code>\n\n"
        "맨 앞에 <code>테스트</code> 를 붙이면 DB에 넣지 않고 미리보기만 합니다."
    )


async def request_poll_input(
    chat_id: int,
    survey_date: str | None = None,
) -> None:
    """관리자에게 투표 수치 입력을 요청."""
    d = (survey_date or next_trading_day_str()).strip()[:10]
    _pending[chat_id] = d
    await send_message(
        chat_id,
        f"📥 <b>{d}</b> 거래일 설문에 반영할 투표 수치를 보내주세요.\n\n"
        f"블라인드 글에서 복사해 그대로 붙여넣으면 됩니다.\n"
        f"예) 상승 62% / 하락 38% / 1,284명 참여\n\n"
        f"미리보기만: 맨 첫 줄에 <code>테스트</code> 추가\n"
        f"취소: /poll cancel",
    )


async def notify_all_admins_poll_request(survey_date: str | None = None) -> int:
    """스케줄러·수동 트리거용. 설정된 관리자 chat_id 전원에게 요청."""
    ids = admin_chat_ids()
    if not ids:
        logger.warning("TELEGRAM_ADMIN_CHAT_ID(S) 미설정 — 투표 입력 요청 생략")
        return 0
    for cid in ids:
        try:
            await request_poll_input(cid, survey_date)
        except Exception as e:
            logger.error("관리자 poll 요청 실패 chat_id=%s: %s", cid, e)
    return len(ids)


def _format_seed_result(result: dict[str, Any]) -> str:
    parsed = result.get("parsed") or result.get("blind_poll") or {}
    seeded = result.get("seeded") or {}
    lines = [
        "✅ <b>설문 시드 완료</b>" if not result.get("dry_run") else "🔍 <b>미리보기 (DB 미반영)</b>",
        f"거래일: <b>{result.get('survey_date')}</b>",
        f"붙여넣기 해석: 상승 <b>{parsed.get('up_pct', '?')}%</b> · "
        f"하락 <b>{parsed.get('down_pct', '?')}%</b> · "
        f"총 <b>{parsed.get('total_votes', '?')}</b>표",
        f"실제 넣은 응답: <b>{seeded.get('total', result.get('created'))}</b>건 "
        f"(상승 {seeded.get('up', '?')} / 하락 {seeded.get('down', '?')})",
    ]
    if seeded.get("scaled_from_blind"):
        lines.append(
            f"※ 블라인드 표본이 커서 최대 {seeded.get('total')}명까지 비율만 맞춰 축소 반영"
        )
    lines.append(f"DB 해당일 응답 합계: <b>{result.get('total_responses_after', '?')}</b>명")
    if result.get("failed"):
        lines.append(f"⚠️ 실패 {result['failed']}건 (로그 확인)")
    return "\n".join(lines)


async def handle_poll_command(
    chat_id: int,
    text: str,
    supabase: Client,
) -> bool:
    """관리자 전용 /poll 명령. 처리했으면 True."""
    if not is_admin_chat(chat_id):
        return False

    parts = text.strip().split()
    if not parts:
        await send_message(chat_id, _help_text())
        return True

    if parts[0].lower().startswith("/poll@"):
        parts = ["/poll", *parts[1:]]

    cmd = parts[0].lower()

    if cmd == "/poll" and len(parts) == 1:
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
        await send_message(chat_id, "입력 대기를 취소했습니다.")
        return True

    if sub in ("clear", "삭제", "reset"):
        sd = parts[2][:10] if len(parts) > 2 else next_trading_day_str()
        out = clear_seed_responses(supabase, sd)
        await send_message(
            chat_id,
            f"🗑 <b>{sd}</b> 시드 정리\n"
            f"봇 계정 {out.get('seed_users_found', 0)}명 · 응답 삭제 시도 {out.get('responses_cleared', 0)}건",
        )
        return True

    await send_message(chat_id, _help_text())
    return True


async def handle_poll_reply(
    chat_id: int,
    text: str,
    supabase: Client,
) -> bool:
    """입력 대기 중인 관리자의 일반 메시지 → 파싱·시드."""
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
        await send_message(chat_id, "투표 수치 본문이 비어 있습니다. 다시 보내주세요.")
        return True

    try:
        result = seed_survey_from_blind_text(
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
            f"❌ 해석 실패: {e.detail}\n\n"
            f"다시 보내거나 /poll cancel",
        )
    except Exception as e:
        logger.exception("telegram poll seed 실패")
        await send_message(chat_id, f"❌ 시드 오류: {e}")

    return True
