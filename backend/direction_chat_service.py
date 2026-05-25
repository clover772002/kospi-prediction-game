# -*- coding: utf-8 -*-
"""일일 단톡방: 상승·하락 한 방, 설문 참여자만, 장 마감 후 종료."""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from krx_calendar import KST, next_trading_day_str, today_date_kst
from supabase import Client

from accuracy_aggregate import get_accuracy_data
from survey_writes import apply_pending_presubmits

logger = logging.getLogger(__name__)


def _today_str() -> str:
    return today_date_kst().isoformat()

MAX_BODY_LEN = int(os.getenv("DIRECTION_CHAT_MAX_BODY", "500"))
MAX_MSG_PER_USER_DAY = int(os.getenv("DIRECTION_CHAT_MAX_MSG_PER_USER", "80"))
# 장 결과·정산(15:35)과 맞춤 — 이 시각에 소통방 종료
ROOM_CLOSE_HOUR = int(os.getenv("DIRECTION_CHAT_CLOSE_HOUR", "15"))
ROOM_CLOSE_MINUTE = int(os.getenv("DIRECTION_CHAT_CLOSE_MINUTE", "35"))


def _survey_date_key(survey_date: str) -> str:
    return str(survey_date).strip()[:10]


def _room_close_at(survey_date: str) -> datetime:
    d = date.fromisoformat(_survey_date_key(survey_date))
    return datetime(
        d.year, d.month, d.day, ROOM_CLOSE_HOUR, ROOM_CLOSE_MINUTE, 0, tzinfo=KST,
    )


def _room_seconds_remaining(survey_date: str, *, closed: bool) -> int:
    if closed:
        return 0
    now = datetime.now(KST)
    close_at = _room_close_at(survey_date)
    return max(0, int((close_at - now).total_seconds()))


def _masked_name(name: str | None) -> str:
    n = (name or "").strip()
    return (n[0] + "**") if n else "익명"


def _side_from_kospi_answer(kospi_answer: bool) -> str:
    return "up" if kospi_answer else "down"


def _team_label(side: str) -> str:
    return "상승" if side == "up" else "하락"


def _accuracy_pct_for_user(acc_map: dict, pred_count: dict, uid: str) -> int | None:
    """누적 코스피 적중률(%). 정산·기록 없으면 None."""
    key = str(uid)
    total = int(pred_count.get(key) or 0)
    if total <= 0:
        return None
    rate = acc_map.get(key)
    if rate is None:
        return None
    return round(float(rate) * 100)


def _display_label(
    masked: str,
    side: str,
    accuracy_pct: int | None = None,
    *,
    is_accuracy_leader: bool = False,
) -> str:
    """채팅에 보이는 이름: (왕관) 초성 닉 + 방향 + 누적 적중률."""
    crown = "👑 " if is_accuracy_leader else ""
    tag = "↑상승" if side == "up" else "↓하락"
    if accuracy_pct is not None:
        return f"{crown}{masked}[{tag}·적중{accuracy_pct}%]"
    return f"{crown}{masked}[{tag}]"


def _room_participant_user_ids(supabase: Client, survey_date: str) -> list[str]:
    """해당 거래일 설문 참여자(이 방 인원)."""
    res = (
        supabase.table("survey_responses")
        .select("user_id")
        .eq("survey_date", survey_date)
        .execute()
    )
    return list({str(r["user_id"]) for r in (res.data or []) if r.get("user_id")})


def _room_accuracy_leader_uid(
    supabase: Client,
    survey_date: str,
    acc_map: dict,
    pred_count: dict,
) -> str | None:
    """방 참여자 중 누적 적중률 1위(동률 시 참여 일수 많은 순). 매 조회마다 재계산."""
    participants = _room_participant_user_ids(supabase, survey_date)
    best: tuple[int, int, str] | None = None
    for uid in participants:
        pct = _accuracy_pct_for_user(acc_map, pred_count, uid)
        if pct is None:
            continue
        total = int(pred_count.get(uid) or 0)
        key = (pct, total, uid)
        if best is None or key > best:
            best = key
    return best[2] if best else None


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


def _user_chat_side_for_date(supabase: Client, user_id: str, survey_date: str) -> str | None:
    """응답 행 또는 미적용 사전 예측(presubmit) 기준 팀 방향."""
    side = _user_response_side(supabase, user_id, survey_date)
    if side:
        return side
    try:
        pr = (
            supabase.table("survey_vote_presubmit")
            .select("gauge_position")
            .eq("user_id", user_id)
            .eq("survey_date", survey_date)
            .is_("canceled_at", "null")
            .is_("applied_at", "null")
            .limit(1)
            .execute()
        )
        if pr.data:
            gp = int(pr.data[0].get("gauge_position") or 0)
            if gp != 0:
                return _side_from_kospi_answer(gp > 0)
    except Exception as e:
        logger.warning("presubmit 조회 실패(단톡): %s", e)
    return None


def _has_chat_eligibility(supabase: Client, user_id: str, survey_date: str) -> bool:
    return _user_chat_side_for_date(supabase, user_id, survey_date) is not None


def resolve_chat_survey_date(supabase: Client, user_id: str) -> str:
    """참여한 거래일 기준 활성 단톡방 — 사전 예측(다음 거래일)만 있으면 그날 방."""
    try:
        apply_pending_presubmits(supabase, user_id)
    except Exception as ex:
        logger.warning("단톡: 예약 설문 적용 스킵 — %s", ex)

    today = _today_str()
    next_d = next_trading_day_str()
    has_today = _has_chat_eligibility(supabase, user_id, today)
    has_next = _has_chat_eligibility(supabase, user_id, next_d)
    today_closed = _room_closed(supabase, today)

    if has_today and not today_closed:
        return today
    if has_next:
        return next_d
    if has_today:
        return today
    return today


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
    side = _user_chat_side_for_date(supabase, user_id, survey_date)
    closed = _room_closed(supabase, survey_date)
    counts = _count_members(supabase, survey_date)
    my_name_row = supabase.table("users").select("name").eq("id", user_id).limit(1).execute()
    my_name = my_name_row.data[0].get("name") if my_name_row.data else None
    my_masked = _masked_name(my_name)
    my_accuracy_pct: int | None = None
    leader_uid: str | None = None
    if side:
        try:
            acc_map, pred_count, _ = get_accuracy_data(supabase)
            my_accuracy_pct = _accuracy_pct_for_user(acc_map, pred_count, user_id)
            leader_uid = _room_accuracy_leader_uid(supabase, survey_date, acc_map, pred_count)
        except Exception as ex:
            logger.warning("단톡: 적중률 조회 스킵 — %s", ex)
    my_display = (
        _display_label(
            my_masked,
            side,
            my_accuracy_pct,
            is_accuracy_leader=leader_uid is not None and str(user_id) == leader_uid,
        )
        if side
        else my_masked
    )

    can_access = side is not None
    can_send = can_access and not closed
    today = _today_str()
    room_title = "오늘 소통방" if survey_date == today else "다음 거래일 소통방"
    close_at = _room_close_at(survey_date)
    secs_left = _room_seconds_remaining(survey_date, closed=closed)

    return {
        "survey_date": survey_date,
        "room_title": room_title,
        "room_open": not closed,
        "room_close_at": close_at.isoformat(),
        "room_seconds_remaining": secs_left,
        "room_closed_reason": (
            f"장이 마감되어 {room_title}방이 종료되었습니다." if closed else None
        ),
        "answered": can_access,
        "my_side": side,
        "my_team_label": _team_label(side) if side else None,
        "my_masked_name": my_masked,
        "my_display_label": my_display,
        "my_accuracy_pct": my_accuracy_pct,
        "accuracy_leader_user_id": leader_uid,
        "member_counts": counts,
        "max_body_len": MAX_BODY_LEN,
        "can_read": can_access,
        "can_send": can_send,
        "send_blocked_reason": (
            "오늘 설문 또는 다음 거래일 사전 예측에 참여하면 소통방을 이용할 수 있습니다."
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
    if not _has_chat_eligibility(supabase, user_id, survey_date):
        raise HTTPException(
            status_code=403,
            detail="해당 거래일 설문·사전 예측에 참여한 사용자만 단톡방을 볼 수 있습니다.",
        )

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
            detail="소통방이 아직 준비되지 않았습니다. schema_direction_chat.sql을 적용해 주세요.",
        ) from e

    data = list(reversed(rows.data or []))
    if not data:
        return []

    msg_uids = list({str(r["user_id"]) for r in data})
    participant_uids = _room_participant_user_ids(supabase, survey_date)
    lookup_uids = list({*msg_uids, *participant_uids})
    names: dict[str, str] = {}
    acc_map: dict = {}
    pred_count: dict = {}
    leader_uid: str | None = None
    if lookup_uids:
        urows = supabase.table("users").select("id, name").in_("id", lookup_uids).execute()
        for u in urows.data or []:
            names[str(u["id"])] = _masked_name(u.get("name"))
        try:
            acc_map, pred_count, _ = get_accuracy_data(supabase)
            leader_uid = _room_accuracy_leader_uid(supabase, survey_date, acc_map, pred_count)
        except Exception as ex:
            logger.warning("단톡 메시지: 적중률 집계 스킵 — %s", ex)

    out: list[dict[str, Any]] = []
    for r in data:
        uid = str(r["user_id"])
        msg_side = str(r.get("side") or "up")
        if msg_side not in ("up", "down"):
            msg_side = "up"
        masked = names.get(uid, "익명")
        acc_pct = _accuracy_pct_for_user(acc_map, pred_count, uid)
        is_leader = leader_uid is not None and uid == leader_uid
        out.append({
            "id": str(r["id"]),
            "user_id": uid,
            "body": r["body"],
            "created_at": r["created_at"],
            "masked_name": masked,
            "display_label": _display_label(
                masked, msg_side, acc_pct, is_accuracy_leader=is_leader,
            ),
            "accuracy_pct": acc_pct,
            "is_accuracy_leader": is_leader,
            "is_mine": uid == user_id,
            "side": msg_side,
        })
    return out


def _send_direction_chat_telegram(
    supabase: Client,
    user_id: str,
    title: str,
    body: str,
) -> bool:
    """웹 푸시 불가(iPhone Safari 등) 시 텔레그램 대체. direction_chat 설정 존중."""
    import httpx
    from webpush_helper import _allowed

    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        return False
    try:
        row = (
            supabase.table("users")
            .select("telegram_chat_id, push_preferences")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not row.data:
            return False
        prefs = row.data[0].get("push_preferences") or {}
        if not _allowed(prefs, "direction_chat"):
            return False
        chat_id = row.data[0].get("telegram_chat_id")
        if not chat_id:
            return False
        base = (os.getenv("PUBLIC_APP_URL") or "https://kospi-prediction-game.vercel.app").rstrip("/")
        text = f"<b>{title}</b>\n{body}\n\n<a href=\"{base}/team-chat\">소통방 열기</a>"
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            return resp.status_code == 200
    except Exception as ex:
        logger.warning("direction-chat 텔레그램 실패 recipient=%s: %s", user_id, ex)
        return False


def _notify_direction_chat_push(
    supabase: Client,
    *,
    sender_id: str,
    survey_date: str,
    sender_masked: str,
    side: str,
    body: str,
) -> None:
    """같은 거래일 단톡 참여자(발신자 제외)에게 웹 푸시 → 실패 시 텔레그램."""
    from webpush_helper import send_web_push_to_user

    snippet = (body or "").strip()
    if len(snippet) > 80:
        snippet = snippet[:77] + "…"
    tag = "↑상승" if side == "up" else "↓하락"
    push_body = f"{sender_masked}[{tag}] {snippet}" if snippet else f"{sender_masked}[{tag}] 새 메시지"
    if len(push_body) > 180:
        push_body = push_body[:177] + "…"
    title = "💬 소통방 새 메시지"

    for uid in _room_participant_user_ids(supabase, survey_date):
        if uid == str(sender_id):
            continue
        try:
            pushed = send_web_push_to_user(
                supabase,
                uid,
                title,
                push_body,
                "/team-chat",
                "direction_chat",
            )
            if not pushed:
                _send_direction_chat_telegram(supabase, uid, title, push_body)
        except Exception as ex:
            logger.warning("direction-chat 알림 실패 recipient=%s: %s", uid, ex)


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

    side = _user_chat_side_for_date(supabase, user_id, survey_date)
    if not side:
        raise HTTPException(
            status_code=403,
            detail="해당 거래일 설문·사전 예측에 참여한 뒤 메시지를 보낼 수 있습니다.",
        )

    if _room_closed(supabase, survey_date):
        raise HTTPException(status_code=403, detail="장이 마감되어 이 소통방은 종료되었습니다.")

    if _user_message_count(supabase, user_id, survey_date) >= MAX_MSG_PER_USER_DAY:
        raise HTTPException(status_code=429, detail="오늘 보낼 수 있는 메시지 한도에 도달했습니다.")

    my_row = supabase.table("users").select("name").eq("id", user_id).limit(1).execute()
    my_masked = _masked_name(my_row.data[0].get("name") if my_row.data else None)
    my_acc_pct: int | None = None
    leader_uid: str | None = None
    try:
        acc_map, pred_count, _ = get_accuracy_data(supabase)
        my_acc_pct = _accuracy_pct_for_user(acc_map, pred_count, user_id)
        leader_uid = _room_accuracy_leader_uid(supabase, survey_date, acc_map, pred_count)
    except Exception as ex:
        logger.warning("단톡 전송: 적중률 조회 스킵 — %s", ex)

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
    try:
        _notify_direction_chat_push(
            supabase,
            sender_id=user_id,
            survey_date=survey_date,
            sender_masked=my_masked,
            side=side,
            body=text,
        )
    except Exception as ex:
        logger.warning("direction-chat 푸시 일괄 발송 스킵: %s", ex)

    return {
        "ok": True,
        "message": {
            "id": str(row["id"]),
            "user_id": user_id,
            "body": text,
            "created_at": row.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "masked_name": my_masked,
            "display_label": _display_label(
                my_masked,
                side,
                my_acc_pct,
                is_accuracy_leader=leader_uid is not None and str(user_id) == leader_uid,
            ),
            "accuracy_pct": my_acc_pct,
            "is_accuracy_leader": leader_uid is not None and str(user_id) == leader_uid,
            "is_mine": True,
            "side": side,
        },
    }


def build_room_payload(
    supabase: Client,
    user_id: str,
    survey_date: str | None = None,
    *,
    limit: int = 80,
) -> dict[str, Any]:
    """단톡 탭 1회 호출용: status + messages. survey_date 생략 시 참여한 거래일 자동 선택."""
    sd = (survey_date or "").strip()[:10] if survey_date else ""
    if len(sd) != 10:
        sd = resolve_chat_survey_date(supabase, user_id)
    status = build_status_payload(supabase, user_id, sd)
    messages: list[dict[str, Any]] = []
    if status.get("can_read"):
        messages = list_room_messages(supabase, user_id, sd, limit=limit)
    return {**status, "messages": messages, "survey_date": sd}
