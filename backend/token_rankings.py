# -*- coding: utf-8 -*-
"""명예의 전당 — 토큰 누적·주간 순위."""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from supabase import Client

from participation_rewards import is_seed_bot_email, today_kst_date, week_bounds_containing

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 30


def _masked_name(name: str | None) -> str:
    n = (name or "").strip()
    return (n[0] + "**") if n else "익명"


def _fetch_name_map(supabase: Client, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    out: dict[str, str] = {}
    chunk = 200
    for i in range(0, len(user_ids), chunk):
        part = user_ids[i : i + chunk]
        try:
            r = supabase.table("users").select("id, name, email").in_("id", part).execute()
        except Exception as e:
            logger.warning("순위: 이름 조회 실패: %s", e)
            continue
        for row in r.data or []:
            uid = str(row["id"])
            if is_seed_bot_email(row.get("email")):
                continue
            out[uid] = _masked_name(row.get("name"))
    return out


def build_cumulative_token_leaderboard(
    supabase: Client,
    *,
    current_user_id: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """보유 토큰(users.tokens) 기준 누적 순위."""
    lim = max(1, min(int(limit), 50))
    try:
        r = (
            supabase.table("users")
            .select("id, name, email, tokens")
            .order("tokens", desc=True)
            .order("id")
            .limit(200)
            .execute()
        )
    except Exception as e:
        logger.warning("누적 토큰 순위 조회 실패: %s", e)
        return []

    rows: list[dict[str, Any]] = []
    for row in r.data or []:
        if is_seed_bot_email(row.get("email")):
            continue
        rows.append({
            "user_id": str(row["id"]),
            "masked_name": _masked_name(row.get("name")),
            "score": int(row.get("tokens") or 100),
        })
        if len(rows) >= lim:
            break

    for i, item in enumerate(rows):
        item["rank"] = i + 1
    return rows


def build_weekly_token_leaderboard(
    supabase: Client,
    *,
    week_start: str | None = None,
    week_end: str | None = None,
    current_user_id: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """이번 주(월~일) 설문 정산 tokens_won 합계 기준 순위."""
    lim = max(1, min(int(limit), 50))
    today = today_kst_date()
    monday, sunday, _ = week_bounds_containing(today)
    start_s = week_start or monday.isoformat()
    end_s = week_end or sunday.isoformat()

    try:
        r = (
            supabase.table("survey_responses")
            .select("user_id, tokens_won")
            .gte("survey_date", start_s)
            .lte("survey_date", end_s)
            .not_.is_("tokens_won", "null")
            .execute()
        )
    except Exception as e:
        logger.warning("주간 토큰 순위 조회 실패: %s", e)
        return []

    sums: dict[str, int] = defaultdict(int)
    for row in r.data or []:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        try:
            sums[uid] += int(row.get("tokens_won") or 0)
        except (TypeError, ValueError):
            continue

    if not sums:
        return []

    name_map = _fetch_name_map(supabase, list(sums.keys()))
    ranked = sorted(sums.items(), key=lambda x: (-x[1], x[0]))
    out: list[dict[str, Any]] = []
    for uid, score in ranked:
        if uid not in name_map:
            continue
        out.append({
            "user_id": uid,
            "masked_name": name_map[uid],
            "score": score,
        })
        if len(out) >= lim:
            break

    for i, item in enumerate(out):
        item["rank"] = i + 1
    return out


def _find_my_rank(entries: list[dict[str, Any]], user_id: str | None) -> int | None:
    if not user_id:
        return None
    for e in entries:
        if e.get("user_id") == user_id:
            return int(e.get("rank") or 0) or None
    return None


def build_hall_of_fame_payload(
    supabase: Client,
    *,
    current_user_id: str,
    limit: int = DEFAULT_LIMIT,
) -> dict[str, Any]:
    today = today_kst_date()
    monday, sunday, week_id = week_bounds_containing(today)
    cumulative = build_cumulative_token_leaderboard(
        supabase, current_user_id=current_user_id, limit=limit
    )
    weekly = build_weekly_token_leaderboard(
        supabase,
        week_start=monday.isoformat(),
        week_end=sunday.isoformat(),
        current_user_id=current_user_id,
        limit=limit,
    )
    return {
        "week_id": week_id,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "cumulative": cumulative,
        "weekly": weekly,
        "my_cumulative_rank": _find_my_rank(cumulative, current_user_id),
        "my_weekly_rank": _find_my_rank(weekly, current_user_id),
    }
