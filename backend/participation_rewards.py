# -*- coding: utf-8 -*-
"""가입·주간 설문 참여 칩 보상 (ledger 멱등)."""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client

from token_wallet import grant_tokens_with_ledger, ledger_exists_by_idempotency

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")
SEED_EMAIL_DOMAIN = "bots.kospi-seed.local"

SIGNUP_BONUS_TOKENS = int(os.getenv("SIGNUP_BONUS_TOKENS", "50"))
SIGNUP_IDEMPOTENCY_KEY = "signup_bonus:v1"

# 거래일 1~5일 참여 시 주간 일괄 지급 (일요일 21:00 KST)
WEEKLY_BONUS_BY_DAYS: dict[int, int] = {
    1: 10,
    2: 20,
    3: 35,
    4: 50,
    5: 70,
}
MAX_WEEKLY_PARTICIPATION_DAYS = 5
WEEKLY_GRANT_HOUR_LABEL = "일요일 21:00"


def is_seed_bot_email(email: str | None) -> bool:
    if not email:
        return False
    return email.endswith(f"@{SEED_EMAIL_DOMAIN}")


def weekly_bonus_for_days(days: int) -> int:
    if days <= 0:
        return 0
    return WEEKLY_BONUS_BY_DAYS.get(min(days, MAX_WEEKLY_PARTICIPATION_DAYS), 0)


def week_bounds_containing(day: date) -> tuple[date, date, str]:
    """해당 날짜가 속한 월~일 구간과 ISO 주차 id (예: 2025-W20)."""
    monday = day - timedelta(days=day.weekday())
    sunday = monday + timedelta(days=6)
    iso = day.isocalendar()
    week_id = f"{iso[0]}-W{iso[1]:02d}"
    return monday, sunday, week_id


def today_kst_date() -> date:
    return datetime.now(KST).date()


def signup_idempotency_key() -> str:
    return SIGNUP_IDEMPOTENCY_KEY


def weekly_idempotency_key(week_id: str, user_id: str) -> str:
    return f"weekly_participation:{week_id}:{user_id}"


def count_participation_days_in_range(
    supabase: Client,
    user_id: str,
    week_start: date,
    week_end: date,
) -> int:
    start_s = week_start.isoformat()
    end_s = week_end.isoformat()
    try:
        r = (
            supabase.table("survey_responses")
            .select("survey_date")
            .eq("user_id", user_id)
            .gte("survey_date", start_s)
            .lte("survey_date", end_s)
            .execute()
        )
    except Exception as e:
        logger.warning("주간 참여 일수 조회 실패 user=%s: %s", user_id, e)
        return 0
    dates: set[str] = set()
    for row in r.data or []:
        sd = row.get("survey_date")
        if sd is None:
            continue
        dates.add(str(sd)[:10])
    return len(dates)


def try_grant_signup_bonus(supabase: Client, user_id: str, *, email: str | None = None) -> dict[str, Any]:
    """신규 가입 1회 +50 (멱등). 시드 봇 제외."""
    if is_seed_bot_email(email):
        return {"granted": False, "skipped": "seed_bot", "delta": 0}
    key = signup_idempotency_key()
    if ledger_exists_by_idempotency(supabase, user_id, key):
        return {"granted": False, "already": True, "delta": 0}
    if SIGNUP_BONUS_TOKENS <= 0:
        return {"granted": False, "disabled": True, "delta": 0}
    try:
        bal = grant_tokens_with_ledger(
            supabase,
            user_id,
            delta=SIGNUP_BONUS_TOKENS,
            reason="signup_bonus",
            ref_type="promo",
            ref_id="signup_welcome",
            idempotency_key=key,
        )
        return {"granted": True, "delta": SIGNUP_BONUS_TOKENS, "balance": bal}
    except PermissionError:
        logger.warning("가입 보너스: user 없음 %s", user_id)
        return {"granted": False, "error": "user_not_found", "delta": 0}
    except Exception as e:
        logger.exception("가입 보너스 지급 실패 user=%s: %s", user_id, e)
        return {"granted": False, "error": str(e), "delta": 0}


def try_grant_weekly_participation(
    supabase: Client,
    user_id: str,
    *,
    week_id: str,
    participation_days: int,
    email: str | None = None,
) -> dict[str, Any]:
    if is_seed_bot_email(email):
        return {"granted": False, "skipped": "seed_bot"}
    delta = weekly_bonus_for_days(participation_days)
    if delta <= 0:
        return {"granted": False, "skipped": "no_participation"}
    key = weekly_idempotency_key(week_id, user_id)
    if ledger_exists_by_idempotency(supabase, user_id, key):
        return {"granted": False, "already": True, "delta": 0}
    try:
        bal = grant_tokens_with_ledger(
            supabase,
            user_id,
            delta=delta,
            reason="weekly_participation",
            ref_type="week",
            ref_id=week_id,
            idempotency_key=key,
        )
        return {
            "granted": True,
            "delta": delta,
            "balance": bal,
            "participation_days": participation_days,
            "week_id": week_id,
        }
    except PermissionError:
        return {"granted": False, "error": "user_not_found"}
    except Exception as e:
        logger.exception("주간 참여 지급 실패 user=%s week=%s: %s", user_id, week_id, e)
        return {"granted": False, "error": str(e)}


def _fetch_user_emails(supabase: Client, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    out: dict[str, str] = {}
    chunk = 200
    for i in range(0, len(user_ids), chunk):
        part = user_ids[i : i + chunk]
        try:
            r = supabase.table("users").select("id, email").in_("id", part).execute()
        except Exception as e:
            logger.warning("주간 지급: users 이메일 조회 실패: %s", e)
            continue
        for row in r.data or []:
            out[str(row["id"])] = str(row.get("email") or "")
    return out


def run_weekly_grants_for_week(
    supabase: Client,
    *,
    week_end: date | None = None,
) -> dict[str, Any]:
    """
    week_end가 속한 월~일 주차에 설문 1일 이상 참여한 유저에게 가중 보너스 일괄 지급.
    스케줄: 해당 주 일요일 21:00 (week_end = 그 일요일).
    """
    end = week_end or today_kst_date()
    monday, sunday, week_id = week_bounds_containing(end)
    start_s = monday.isoformat()
    end_s = sunday.isoformat()

    try:
        r = (
            supabase.table("survey_responses")
            .select("user_id, survey_date")
            .gte("survey_date", start_s)
            .lte("survey_date", end_s)
            .execute()
        )
    except Exception as e:
        logger.exception("주간 지급: 응답 목록 조회 실패 week=%s: %s", week_id, e)
        return {"ok": False, "error": str(e), "week_id": week_id}

    per_user_dates: dict[str, set[str]] = {}
    for row in r.data or []:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        sd = row.get("survey_date")
        if sd is None:
            continue
        per_user_dates.setdefault(uid, set()).add(str(sd)[:10])

    user_ids = list(per_user_dates.keys())
    emails = _fetch_user_emails(supabase, user_ids)

    granted = 0
    skipped = 0
    errors = 0
    total_delta = 0

    for uid, dates in per_user_dates.items():
        days = len(dates)
        res = try_grant_weekly_participation(
            supabase,
            uid,
            week_id=week_id,
            participation_days=days,
            email=emails.get(uid),
        )
        if res.get("granted"):
            granted += 1
            total_delta += int(res.get("delta") or 0)
        elif res.get("already") or res.get("skipped"):
            skipped += 1
        elif res.get("error"):
            errors += 1

    summary = {
        "ok": True,
        "week_id": week_id,
        "week_start": start_s,
        "week_end": end_s,
        "eligible_users": len(per_user_dates),
        "granted": granted,
        "skipped": skipped,
        "errors": errors,
        "total_delta": total_delta,
    }
    logger.info("주간 참여 칩 지급 완료: %s", summary)
    return summary


def build_participation_status(supabase: Client, user_id: str) -> dict[str, Any]:
    """대시보드·설문 UI용 — 이번 주 진행·예상 보너스."""
    today = today_kst_date()
    monday, sunday, week_id = week_bounds_containing(today)
    days = count_participation_days_in_range(supabase, user_id, monday, sunday)
    projected = weekly_bonus_for_days(days)
    next_tier_days = None
    next_tier_bonus = None
    if days < MAX_WEEKLY_PARTICIPATION_DAYS:
        nd = days + 1
        next_tier_days = nd
        next_tier_bonus = weekly_bonus_for_days(nd)

    signup_received = ledger_exists_by_idempotency(supabase, user_id, signup_idempotency_key())

    return {
        "week_id": week_id,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "days_this_week": days,
        "max_days": MAX_WEEKLY_PARTICIPATION_DAYS,
        "projected_weekly_bonus": projected,
        "next_tier_days": next_tier_days,
        "next_tier_bonus": next_tier_bonus,
        "grant_schedule_label": WEEKLY_GRANT_HOUR_LABEL,
        "signup_bonus_received": signup_received,
        "signup_bonus_amount": SIGNUP_BONUS_TOKENS if not signup_received else 0,
    }
