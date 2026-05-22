# -*- coding: utf-8 -*-
"""일일 단톡방: 상승·하락 한 방, 설문 참여자만, 장 마감 후 종료."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from supabase import Client

logger = logging.getLogger(__name__)

MAX_BODY_LEN = int(os.getenv("DIRECTION_CHAT_MAX_BODY", "500"))
MAX_MSG_PER_USER_DAY = int(os.getenv("DIRECTION_CHAT_MAX_MSG_PER_USER", "80"))


def _masked_name(name: str | None) -> str:
    n = (name or "").strip()
    return (n[0] + "**") if n else "익명"


def _side_from_kospi_answer(kospi_answer: bool) -> str:
    return "up" if kospi_answer else "down"


def _team_label(side: str) -> str:
    return "상승" if side == "up" else "하락"


def _display_label(masked: str, side: str) -> str:
    """채팅에 보이는 이름: 초성 닉 + 예측 방향."""
    tag = "↑상승" if side == "up" else "↓하락"
    return f"{masked}[{tag}]"


def _room_closed(supabase: Client, survey_date: str) -> bool:
    row = (
        supabase.table("daily_surveys")
        .select("kospi_result")
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not row.data:
        return True
    return row.data[0].get("kospi_result") is not None


def _user_response_side(supabase: Client, user_id: str, survey_date: str) -> str | None:
    res = (
        supabase.table("survey_responses")
        .select("kospi_answer")
        .eq("user_id", user_id)
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    ka = res.data[0].get("kospi_answer")
    if ka is None:
        return None
    return _side_from_kospi_answer(bool(ka))


def _count_members(supabase: Client, survey_date: str) -> dict[str, int]:
    res = (
        supabase.table("survey_responses")
        .select("kospi_answer")
        .eq("survey_date", survey_date)
        .execute()
    )
    up = down = 0
    for r in res.data or []:
        if r.get("kospi_answer") is True:
            up += 1
        elif r.get("kospi_answer") is False:
            down += 1
    return {"up": up, "down": down, "total": len(res.data or [])}


def _user_message_count(supabase: Client, user_id: str, survey_date: str) -> int:
    try:
        r = (
            supabase.table("direction_room_messages")
            .select("id", count="exact", head=True)
            .eq("survey_date", survey_date)
            .eq("user_id", user_id)
            .execute()
        )
        return int(r.count or 0)
    except Exception as e:
        logger.warning("direction_room_messages count 실패(테이블 미적용?): %s", e)
        return 0


def build_status_payload(
    supabase: Client,
    user_id: str,
    survey_date: str,
) -> dict[str, Any]:
    side = _user_response_side(supabase, user_id, survey_date)
    closed = _room_closed(supabase, survey_date)
    counts = _count_members(supabase, survey_date)
    my_name_row = supabase.table("users").select("name").eq("id", user_id).limit(1).execute()
    my_name = my_name_row.data[0].get("name") if my_name_row.data else None
    my_masked = _masked_name(my_name)
    my_display = _display_label(my_masked, side) if side else my_masked

    can_access = side is not None
    can_send = can_access and not closed

    return {
        "survey_date": survey_date,
        "room_open": not closed,
        "room_closed_reason": "장이 마감되어 오늘 단톡방이 종료되었습니다." if closed else None,
        "answered": can_access,
        "my_side": side,
        "my_team_label": _team_label(side) if side else None,
        "my_masked_name": my_masked,
        "my_display_label": my_display,
        "member_counts": counts,
        "max_body_len": MAX_BODY_LEN,
        "can_read": can_access,
        "can_send": can_send,
        "send_blocked_reason": (
            "오늘 설문에 참여하면 단톡방을 이용할 수 있습니다."
            if not can_access
            else ("장 마감 후에는 새 메시지를 보낼 수 없습니다." if closed else None)
        ),
    }


def list_room_messages(
    supabase: Client,
    user_id: str,
    survey_date: str,
    *,
    limit: int = 80,
) -> list[dict[str, Any]]:
    if not _user_response_side(supabase, user_id, survey_date):
        raise HTTPException(status_code=403, detail="오늘 설문에 참여한 사용자만 단톡방을 볼 수 있습니다.")

    try:
        rows = (
            supabase.table("direction_room_messages")
            .select("id, user_id, body, side, created_at")
            .eq("survey_date", survey_date)
            .order("created_at", desc=True)
            .limit(min(limit, 120))
            .execute()
        )
    except Exception as e:
        logger.exception("direction_room_messages 조회 실패: %s", e)
        raise HTTPException(
            status_code=503,
            detail="단톡방이 아직 준비되지 않았습니다. schema_direction_chat.sql을 적용해 주세요.",
        ) from e

    data = list(reversed(rows.data or []))
    if not data:
        return []

    uids = list({str(r["user_id"]) for r in data})
    names: dict[str, str] = {}
    if uids:
        urows = supabase.table("users").select("id, name").in_("id", uids).execute()
        for u in urows.data or []:
            names[str(u["id"])] = _masked_name(u.get("name"))

    out: list[dict[str, Any]] = []
    for r in data:
        uid = str(r["user_id"])
        msg_side = str(r.get("side") or "up")
        if msg_side not in ("up", "down"):
            msg_side = "up"
        masked = names.get(uid, "익명")
        out.append({
            "id": str(r["id"]),
            "user_id": uid,
            "body": r["body"],
            "created_at": r["created_at"],
            "masked_name": masked,
            "display_label": _display_label(masked, msg_side),
            "is_mine": uid == user_id,
            "side": msg_side,
        })
    return out


def post_room_message(
    supabase: Client,
    user_id: str,
    survey_date: str,
    body: str,
) -> dict[str, Any]:
    text = (body or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")
    if len(text) > MAX_BODY_LEN:
        raise HTTPException(status_code=400, detail=f"메시지는 {MAX_BODY_LEN}자 이하입니다.")

    side = _user_response_side(supabase, user_id, survey_date)
    if not side:
        raise HTTPException(status_code=403, detail="오늘 설문에 참여한 뒤 메시지를 보낼 수 있습니다.")

    if _room_closed(supabase, survey_date):
        raise HTTPException(status_code=403, detail="장이 마감되어 이 단톡방은 종료되었습니다.")

    if _user_message_count(supabase, user_id, survey_date) >= MAX_MSG_PER_USER_DAY:
        raise HTTPException(status_code=429, detail="오늘 보낼 수 있는 메시지 한도에 도달했습니다.")

    my_row = supabase.table("users").select("name").eq("id", user_id).limit(1).execute()
    my_masked = _masked_name(my_row.data[0].get("name") if my_row.data else None)

    try:
        ins = (
            supabase.table("direction_room_messages")
            .insert({
                "survey_date": survey_date,
                "side": side,
                "user_id": user_id,
                "body": text,
            })
            .execute()
        )
    except Exception as e:
        logger.exception("direction_room_messages 저장 실패: %s", e)
        raise HTTPException(
            status_code=503,
            detail="단톡방 저장에 실패했습니다. DB 스키마를 확인해 주세요.",
        ) from e

    if not ins.data:
        raise HTTPException(status_code=500, detail="메시지를 저장하지 못했습니다.")

    row = ins.data[0]
    return {
        "ok": True,
        "message": {
            "id": str(row["id"]),
            "user_id": user_id,
            "body": text,
            "created_at": row.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "masked_name": my_masked,
            "display_label": _display_label(my_masked, side),
            "is_mine": True,
            "side": side,
        },
    }


def build_room_payload(
    supabase: Client,
    user_id: str,
    survey_date: str,
    *,
    limit: int = 80,
) -> dict[str, Any]:
    """단톡 탭 1회 호출용: status + messages."""
    status = build_status_payload(supabase, user_id, survey_date)
    messages: list[dict[str, Any]] = []
    if status.get("can_read"):
        messages = list_room_messages(supabase, user_id, survey_date, limit=limit)
    return {**status, "messages": messages, "survey_date": survey_date}
