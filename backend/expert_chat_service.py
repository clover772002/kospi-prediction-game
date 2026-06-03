# -*- coding: utf-8 -*-
"""초고수 소통: 리더보드 스냅샷·스레드·칩 전달(멱등)."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from supabase import Client

from daily_kospi_leaderboard import build_kospi_leaderboard_for_survey_date
from expert_tier import global_top_expert_uid
from token_wallet import grant_tokens_with_ledger, spend_tokens_idempotent

logger = logging.getLogger(__name__)

TIP_TOKENS = int(os.getenv("EXPERT_CHAT_TIP_TOKENS", "25"))
# 시작 100칩 대비 약 3회 적중·참여 분량(기본 100 + ~110) — 한 번만 100% 맞춰 열리는 것 방지
MIN_TAB_BALANCE = int(os.getenv("EXPERT_CHAT_MIN_TAB_BALANCE", "210"))
TOP_N = 1
MAX_BODY_LEN = int(os.getenv("EXPERT_CHAT_MAX_BODY", "1200"))
MAX_MESSAGES_PER_PARTICIPANT_SURVEY = int(os.getenv("EXPERT_CHAT_MAX_MSG_PER_SURVEY", "30"))

TAB_BLOCKED_REASON = f"초고수 소통은 칩 {MIN_TAB_BALANCE}개 이상부터 이용할 수 있습니다."


def user_token_balance(supabase: Client, user_id: str) -> int:
    bal_row = supabase.table("users").select("tokens").eq("id", user_id).execute()
    return int(bal_row.data[0].get("tokens") or 100) if bal_row.data else 100


def assert_expert_chat_tab_access(supabase: Client, user_id: str) -> int:
    """명예의 전당(초고수 소통) 탭·API 잠금(현재 잔액 기준)."""
    balance = user_token_balance(supabase, user_id)
    if balance < MIN_TAB_BALANCE:
        raise HTTPException(status_code=403, detail=TAB_BLOCKED_REASON)
    return balance


def _resolve_global_top_recipient(
    entries: list[dict], leader_uid: str | None, recipient_user_id: str | None
) -> str | None:
    if not leader_uid:
        return None
    entry = next((e for e in entries if str(e["user_id"]) == leader_uid), None)
    if not entry:
        return None
    if recipient_user_id is None or str(recipient_user_id).strip() == "":
        return leader_uid
    rid = str(recipient_user_id).strip()
    if rid != leader_uid:
        return None
    return leader_uid


def _legacy_expert_grant_exists_for_message(
    supabase: Client,
    *,
    expert_id: str,
    message_id: str,
) -> bool:
    """과거 즉시지급 로직으로 이미 expert에게 들어간 내역(token_ledger)이 있는지."""
    try:
        r = (
            supabase.table("token_ledger")
            .select("id")
            .eq("user_id", expert_id)
            .eq("ref_type", "expert_message")
            .eq("ref_id", message_id)
            .gt("delta", 0)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception as e:
        logger.warning("token_ledger 정산 확인 실패(table 없음 등): %s", e)
        return False


def _touch_thread_updated(supabase: Client, thread_id: str) -> None:
    try:
        supabase.table("expert_message_threads").update(
            {"updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", thread_id).execute()
    except Exception as e:
        logger.warning("thread updated_at 갱신 실패: %s", e)


def _ensure_thread(supabase: Client, survey_date: str, participant_id: str, expert_id: str) -> str:
    existing = (
        supabase.table("expert_message_threads")
        .select("id")
        .eq("survey_date", survey_date)
        .eq("participant_id", participant_id)
        .eq("expert_user_id", expert_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return str(existing.data[0]["id"])
    ins = (
        supabase.table("expert_message_threads")
        .insert({
            "survey_date": survey_date,
            "participant_id": participant_id,
            "expert_user_id": expert_id,
        })
        .execute()
    )
    if not ins.data:
        raise HTTPException(status_code=500, detail="스레드를 만들지 못했습니다.")
    return str(ins.data[0]["id"])


def _count_participant_messages_on_survey(supabase: Client, participant_id: str, survey_date: str) -> int:
    try:
        th = (
            supabase.table("expert_message_threads")
            .select("id")
            .eq("survey_date", survey_date)
            .eq("participant_id", participant_id)
            .execute()
        )
        tids = [str(r["id"]) for r in (th.data or [])]
        n = 0
        for tid in tids:
            m = (
                supabase.table("expert_messages")
                .select("id")
                .eq("thread_id", tid)
                .eq("sender_id", participant_id)
                .execute()
            )
            n += len(m.data or [])
        return n
    except Exception as e:
        logger.warning("participant message count 실패: %s", e)
        return 0


def build_eligibility_payload(
    supabase: Client,
    *,
    survey_date: str,
    current_user_id: str,
) -> dict[str, Any]:
    entries = build_kospi_leaderboard_for_survey_date(supabase, survey_date)
    leader_uid, leader_err = global_top_expert_uid(supabase)
    top_entry = next((e for e in entries if str(e["user_id"]) == leader_uid), None) if leader_uid else None
    top_slice = [top_entry] if top_entry else []
    allowed_ids = [leader_uid] if top_entry and leader_uid else []

    me_entry = next((e for e in entries if e["user_id"] == current_user_id), None)
    my_rank = me_entry["rank"] if me_entry else None

    my_balance = user_token_balance(supabase, current_user_id)
    can_access_tab = my_balance >= MIN_TAB_BALANCE

    default_expert = leader_uid if top_entry else None
    can_message_leader = bool(top_entry and leader_uid and leader_uid != current_user_id)
    can_send = bool(can_access_tab and can_message_leader and my_balance >= TIP_TOKENS)

    def _blocked() -> str:
        if not can_access_tab:
            return TAB_BLOCKED_REASON
        if leader_err == "segment_empty":
            return "아직 칩 1위 초고수를 정할 참가자가 없어요"
        if not top_entry:
            return "오늘 설문에 참여한 초고수가 없어요"
        if leader_uid == current_user_id:
            return "초고수 본인은 질문을 보낼 수 없어요"
        if my_balance < TIP_TOKENS:
            return f"질문 보내기에 칩이 부족해요. (필요 {TIP_TOKENS}개)"
        return "초고수에게 보낼 수 없어요"

    send_blocked_reason: str | None = None if can_send else _blocked()
    tab_blocked_reason: str | None = None if can_access_tab else TAB_BLOCKED_REASON

    is_global_top_expert = bool(leader_uid and not leader_err and leader_uid == current_user_id)
    receives_expert_questions_today = bool(is_global_top_expert and top_entry)

    return {
        "survey_date": survey_date,
        "tip_tokens_per_message": TIP_TOKENS,
        "min_balance_for_tab": MIN_TAB_BALANCE,
        "top_n": TOP_N,
        "my_balance": my_balance,
        "my_rank": my_rank,
        "rank1": top_entry,
        "top_recipients": top_slice,
        "allowed_recipient_ids": allowed_ids,
        "default_recipient_id": default_expert,
        "can_access_expert_chat": can_access_tab,
        "tab_blocked_reason": tab_blocked_reason,
        "can_send_message": can_send,
        "send_blocked_reason": send_blocked_reason,
        "is_global_top_expert": is_global_top_expert,
        "receives_expert_questions_today": receives_expert_questions_today,
    }


def send_participant_message(
    supabase: Client,
    *,
    participant_id: str,
    survey_date: str,
    body: str,
    recipient_user_id: str | None,
    idempotency_key: str | None,
) -> dict[str, Any]:
    body = (body or "").strip()
    if not body:
        raise HTTPException(status_code=422, detail="메시지 내용이 비어 있습니다.")
    if len(body) > MAX_BODY_LEN:
        raise HTTPException(status_code=422, detail=f"메시지는 {MAX_BODY_LEN}자 이하로 보내 주세요.")

    assert_expert_chat_tab_access(supabase, participant_id)

    key = (idempotency_key or "").strip() or str(uuid.uuid4())

    dup = (
        supabase.table("expert_messages")
        .select("id, thread_id, tip_tokens, tip_accepted_at")
        .eq("send_idempotency_key", key)
        .limit(1)
        .execute()
    )
    if dup.data:
        row = dup.data[0]
        tid = str(row["thread_id"])
        u_after = (
            supabase.table("users")
            .select("tokens")
            .eq("id", participant_id)
            .limit(1)
            .execute()
        )
        row_u = u_after.data[0] if u_after.data else None
        bal_after = int(row_u["tokens"]) if row_u and row_u.get("tokens") is not None else None
        return {
            "ok": True,
            "duplicate": True,
            "thread_id": tid,
            "message_id": str(row["id"]),
            "tip_tokens": int(row.get("tip_tokens") or 0),
            "tip_accepted_at": row.get("tip_accepted_at"),
            "balance": bal_after,
        }

    entries = build_kospi_leaderboard_for_survey_date(supabase, survey_date)
    leader_uid, _ = global_top_expert_uid(supabase)
    expert_id = _resolve_global_top_recipient(entries, leader_uid, recipient_user_id)
    if not expert_id:
        raise HTTPException(
            status_code=400,
            detail="오늘 설문에 참여한 초고수에게만 보낼 수 있어요.",
        )
    if expert_id == participant_id:
        raise HTTPException(status_code=400, detail="본인에게는 보낼 수 없어요.")

    if _count_participant_messages_on_survey(supabase, participant_id, survey_date) >= MAX_MESSAGES_PER_PARTICIPANT_SURVEY:
        raise HTTPException(status_code=429, detail="이 거래일에 보낼 수 있는 메시지 수를 초과했어요.")

    thread_id = _ensure_thread(supabase, survey_date, participant_id, expert_id)

    spend = spend_tokens_idempotent(
        supabase,
        participant_id,
        amount=TIP_TOKENS,
        reason="expert_tip_send",
        ref_type="expert_thread",
        ref_id=thread_id,
        idempotency_key=key,
    )
    if not spend.get("ok"):
        bd = spend.get("balance")
        raise HTTPException(
            status_code=402,
            detail=f"칩이 부족합니다. 필요 {TIP_TOKENS} · 보유 {bd if bd is not None else '?'}",
        )
    if not spend.get("spent"):
        dup_msg = (
            supabase.table("expert_messages")
            .select("id, thread_id, tip_tokens, tip_accepted_at")
            .eq("send_idempotency_key", key)
            .limit(1)
            .execute()
        )
        if dup_msg.data:
            dr = dup_msg.data[0]
            return {
                "ok": True,
                "duplicate": True,
                "thread_id": str(dr["thread_id"]),
                "message_id": str(dr["id"]),
                "tip_tokens": int(dr.get("tip_tokens") or 0),
                "tip_accepted_at": dr.get("tip_accepted_at"),
                "balance": spend.get("balance"),
            }
        return {
            "ok": True,
            "duplicate": True,
            "thread_id": thread_id,
            "balance": spend.get("balance"),
        }

    msg_row: dict[str, Any] | None = None
    try:
        ins = (
            supabase.table("expert_messages")
            .insert({
                "thread_id": thread_id,
                "sender_id": participant_id,
                "body": body,
                "tip_tokens": TIP_TOKENS,
                "send_idempotency_key": key,
            })
            .execute()
        )
        if not ins.data:
            raise RuntimeError("message insert empty")
        msg_row = ins.data[0]
    except Exception as e:
        logger.exception("expert message insert 실패: %s", e)
        try:
            grant_tokens_with_ledger(
                supabase,
                participant_id,
                delta=TIP_TOKENS,
                reason="expert_tip_insert_fail_refund",
                ref_type="expert_thread",
                ref_id=thread_id,
                idempotency_key=f"{key}:refund_ins",
            )
        except Exception as re:
            logger.critical("전송 실패 후 환급도 실패 user=%s key=%s: %s", participant_id, key, re)
        raise HTTPException(status_code=500, detail="메시지 저장에 실패했습니다. 칩은 환급됐을 수 있어요.") from e

    msg_id = str(msg_row["id"])
    _touch_thread_updated(supabase, thread_id)

    urow = supabase.table("users").select("tokens").eq("id", participant_id).limit(1).execute()
    bal_p = int(urow.data[0].get("tokens") or 100) if urow.data else 100

    return {
        "ok": True,
        "duplicate": False,
        "thread_id": thread_id,
        "message_id": msg_id,
        "tip_tokens": TIP_TOKENS,
        "expert_user_id": expert_id,
        "tip_tokens_pending_expert_accept": True,
        "tip_accepted_at": None,
        "balance": bal_p,
    }


def accept_participant_tip(
    supabase: Client,
    *,
    expert_id: str,
    message_id: str,
) -> dict[str, Any]:
    """초고수가 참가자 메시지에 붙은 팁을 수락했을 때 정산합니다 (멱등)."""
    mid = (message_id or "").strip()
    if not mid:
        raise HTTPException(status_code=400, detail="message_id가 필요합니다.")

    assert_expert_chat_tab_access(supabase, expert_id)

    m = (
        supabase.table("expert_messages")
        .select("id, thread_id, sender_id, tip_tokens, tip_accepted_at")
        .eq("id", mid)
        .limit(1)
        .execute()
    )
    if not m.data:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없어요.")
    msg = m.data[0]
    thread_id = str(msg["thread_id"])
    tips = int(msg.get("tip_tokens") or 0)
    accepted_at = msg.get("tip_accepted_at")

    th = (
        supabase.table("expert_message_threads")
        .select("id, expert_user_id, participant_id")
        .eq("id", thread_id)
        .limit(1)
        .execute()
    )
    if not th.data:
        raise HTTPException(status_code=404, detail="스레드를 찾을 수 없어요.")
    t_row = th.data[0]
    if str(t_row["expert_user_id"]) != expert_id:
        raise HTTPException(status_code=403, detail="팁 수락 권한이 없어요.")
    if str(msg["sender_id"]) != str(t_row["participant_id"]):
        raise HTTPException(status_code=400, detail="참가자 메시지만 수락할 수 있어요.")
    if tips <= 0:
        raise HTTPException(status_code=400, detail="이 메시지에는 받을 팁이 없어요.")

    if accepted_at:
        uw = (
            supabase.table("users")
            .select("tokens")
            .eq("id", expert_id)
            .limit(1)
            .execute()
        )
        bal = int(uw.data[0].get("tokens") or 100) if uw.data else 100
        return {
            "ok": True,
            "duplicate": True,
            "message_id": mid,
            "tip_tokens": tips,
            "tip_accepted_at": accepted_at,
            "balance": bal,
        }

    if _legacy_expert_grant_exists_for_message(supabase, expert_id=expert_id, message_id=mid):
        try:
            supabase.table("expert_messages").update(
                {"tip_accepted_at": datetime.now(timezone.utc).isoformat()},
            ).eq("id", mid).execute()
        except Exception as e:
            logger.warning("레거시 팁 상태 마킹 실패 msg=%s: %s", mid, e)
        uw = (
            supabase.table("users")
            .select("tokens")
            .eq("id", expert_id)
            .limit(1)
            .execute()
        )
        bal = int(uw.data[0].get("tokens") or 100) if uw.data else 100
        return {
            "ok": True,
            "duplicate": True,
            "message_id": mid,
            "tip_tokens": tips,
            "already_settled_via_ledger": True,
            "tip_accepted_at": datetime.now(timezone.utc).isoformat(),
            "balance": bal,
        }

    try:
        grant_tokens_with_ledger(
            supabase,
            expert_id,
            delta=tips,
            reason="expert_tip_accept",
            ref_type="expert_message",
            ref_id=mid,
            idempotency_key=f"expert_tip_accept:{mid}",
        )
    except Exception as e:
        logger.exception("초고수 팁 수락 지급 실패 msg=%s: %s", mid, e)
        raise HTTPException(status_code=500, detail="칩 정산에 실패했습니다. 잠시 후 다시 시도해 주세요.") from e

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("expert_messages").update({"tip_accepted_at": now_iso}).eq("id", mid).execute()
    except Exception as e:
        logger.warning("tip_accepted_at 갱신 실패(지급은 됨): %s", e)

    _touch_thread_updated(supabase, thread_id)

    uw = supabase.table("users").select("tokens").eq("id", expert_id).limit(1).execute()
    bal_e = int(uw.data[0].get("tokens") or 100) if uw.data else 100

    return {
        "ok": True,
        "duplicate": False,
        "message_id": mid,
        "tip_tokens": tips,
        "tip_accepted_at": now_iso,
        "balance": bal_e,
    }


def post_expert_reply(
    supabase: Client,
    *,
    expert_id: str,
    thread_id: str,
    body: str,
) -> dict[str, Any]:
    body = (body or "").strip()
    if not body:
        raise HTTPException(status_code=422, detail="답장 내용이 비어 있습니다.")
    if len(body) > MAX_BODY_LEN:
        raise HTTPException(status_code=422, detail=f"답장은 {MAX_BODY_LEN}자 이하로 보내 주세요.")

    assert_expert_chat_tab_access(supabase, expert_id)

    th = (
        supabase.table("expert_message_threads")
        .select("id, expert_user_id, participant_id, survey_date")
        .eq("id", thread_id)
        .limit(1)
        .execute()
    )
    if not th.data:
        raise HTTPException(status_code=404, detail="스레드를 찾을 수 없어요.")
    row = th.data[0]
    if str(row["expert_user_id"]) != expert_id:
        raise HTTPException(status_code=403, detail="이 스레드에 답장할 권한이 없어요.")

    ins = (
        supabase.table("expert_messages")
        .insert({
            "thread_id": thread_id,
            "sender_id": expert_id,
            "body": body,
            "tip_tokens": 0,
            "send_idempotency_key": None,
        })
        .execute()
    )
    if not ins.data:
        raise HTTPException(status_code=500, detail="답장 저장에 실패했습니다.")
    _touch_thread_updated(supabase, thread_id)
    return {
        "ok": True,
        "message_id": str(ins.data[0]["id"]),
        "participant_id": str(row["participant_id"]),
        "survey_date": str(row["survey_date"]),
    }


def list_threads_for_user(supabase: Client, user_id: str) -> list[dict[str, Any]]:
    """내가 participant 이거나 expert 인 스레드 요약."""
    assert_expert_chat_tab_access(supabase, user_id)
    as_p = (
        supabase.table("expert_message_threads")
        .select("id, survey_date, participant_id, expert_user_id, updated_at")
        .eq("participant_id", user_id)
        .order("updated_at", desc=True)
        .limit(50)
        .execute()
    )
    as_e = (
        supabase.table("expert_message_threads")
        .select("id, survey_date, participant_id, expert_user_id, updated_at")
        .eq("expert_user_id", user_id)
        .order("updated_at", desc=True)
        .limit(50)
        .execute()
    )
    rows = (as_p.data or []) + (as_e.data or [])
    seen = set()
    out: list[dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: x.get("updated_at") or "", reverse=True):
        tid = str(r["id"])
        if tid in seen:
            continue
        seen.add(tid)
        role = "participant" if str(r["participant_id"]) == user_id else "expert"
        out.append({
            "thread_id": tid,
            "survey_date": str(r["survey_date"]),
            "participant_id": str(r["participant_id"]),
            "expert_user_id": str(r["expert_user_id"]),
            "my_role": role,
            "updated_at": r.get("updated_at"),
        })
    return out[:50]


def list_messages(supabase: Client, thread_id: str, user_id: str) -> list[dict[str, Any]]:
    assert_expert_chat_tab_access(supabase, user_id)
    th = (
        supabase.table("expert_message_threads")
        .select("id, participant_id, expert_user_id")
        .eq("id", thread_id)
        .limit(1)
        .execute()
    )
    if not th.data:
        raise HTTPException(status_code=404, detail="스레드를 찾을 수 없어요.")
    r = th.data[0]
    if user_id not in (str(r["participant_id"]), str(r["expert_user_id"])):
        raise HTTPException(status_code=403, detail="이 스레드를 볼 수 없어요.")

    msgs = (
        supabase.table("expert_messages")
        .select("id, sender_id, body, tip_tokens, tip_accepted_at, created_at")
        .eq("thread_id", thread_id)
        .order("created_at", desc=False)
        .limit(100)
        .execute()
    )
    return [dict(m) for m in (msgs.data or [])]
