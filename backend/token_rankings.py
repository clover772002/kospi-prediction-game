# -*- coding: utf-8 -*-
"""명예의 전당 — 칩·적중률 누적·주간 순위."""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from supabase import Client

from accuracy_aggregate import get_accuracy_data
from participation_rewards import is_seed_bot_email, today_kst_date, week_bounds_containing
from weekly_survival import list_current_weekly_survivors

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
    """보유 칩(users.tokens) 기준 누적 순위."""
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
        logger.warning("누적 칩 순위 조회 실패: %s", e)
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
        logger.warning("주간 칩 순위 조회 실패: %s", e)
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


def _cell_truthy_bool(v) -> bool | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        sl = v.strip().lower()
        if sl in ("true", "t", "1", "yes"):
            return True
        if sl in ("false", "f", "0", "no"):
            return False
    if isinstance(v, (int, float)):
        if v == 1:
            return True
        if v == 0:
            return False
    return None


def _assign_ranks(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for i, item in enumerate(entries):
        item["rank"] = i + 1
    return entries


def _build_accuracy_leaderboard_from_stats(
    stats: dict[str, dict[str, int]],
    name_map: dict[str, str],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    """stats[uid] = {correct, total}. 적중률 내림차순 → 동률 시 참여 일수."""
    lim = max(1, min(int(limit), 50))
    candidates: list[dict[str, Any]] = []
    for uid, s in stats.items():
        if uid not in name_map:
            continue
        total = int(s.get("total") or 0)
        correct = int(s.get("correct") or 0)
        if total <= 0:
            continue
        pct = round(correct / total * 100)
        candidates.append({
            "user_id": uid,
            "masked_name": name_map[uid],
            "score": pct,
            "correct": correct,
            "total": total,
        })
    candidates.sort(key=lambda x: (-x["score"], -x["total"], x["user_id"]))
    return _assign_ranks(candidates[:lim])


def build_cumulative_accuracy_leaderboard(
    supabase: Client,
    *,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """전체 기간 코스피 예측 적중률(accuracy_records 집계)."""
    try:
        _, _, user_scores = get_accuracy_data(supabase)
    except Exception as e:
        logger.warning("누적 적중률 순위 실패: %s", e)
        return []
    uids = list(user_scores.keys())
    name_map = _fetch_name_map(supabase, uids)
    return _build_accuracy_leaderboard_from_stats(user_scores, name_map, limit=limit)


def build_weekly_accuracy_leaderboard(
    supabase: Client,
    *,
    week_start: str | None = None,
    week_end: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """이번 주(월~일) 확정된 코스피 예측 적중률."""
    today = today_kst_date()
    monday, sunday, _ = week_bounds_containing(today)
    start_s = week_start or monday.isoformat()
    end_s = week_end or sunday.isoformat()

    try:
        r = (
            supabase.table("accuracy_records")
            .select("user_id, kospi_correct")
            .gte("survey_date", start_s)
            .lte("survey_date", end_s)
            .execute()
        )
    except Exception as e:
        logger.warning("주간 적중률 순위 조회 실패: %s", e)
        return []

    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    for row in r.data or []:
        kc = _cell_truthy_bool(row.get("kospi_correct"))
        if kc is None:
            continue
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        stats[uid]["total"] += 1
        if kc:
            stats[uid]["correct"] += 1

    if not stats:
        return []

    name_map = _fetch_name_map(supabase, list(stats.keys()))
    return _build_accuracy_leaderboard_from_stats(dict(stats), name_map, limit=limit)


def _find_my_rank(entries: list[dict[str, Any]], user_id: str | None) -> int | None:
    if not user_id:
        return None
    for e in entries:
        if e.get("user_id") == user_id:
            return int(e.get("rank") or 0) or None
    return None


def _my_entry_from_ranked(
    ranked: list[dict[str, Any]],
    user_id: str | None,
) -> dict[str, Any] | None:
    if not user_id:
        return None
    for i, item in enumerate(ranked):
        if item.get("user_id") == user_id:
            out = dict(item)
            out["rank"] = i + 1
            return out
    return None


def find_my_cumulative_token_entry(
    supabase: Client,
    user_id: str,
) -> dict[str, Any] | None:
    """상위 N 밖이어도 보유 칩 기준 전체 순위·점수."""
    try:
        me_r = (
            supabase.table("users")
            .select("id, name, email, tokens")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("내 누적 칩 순위 조회 실패: %s", e)
        return None
    rows = me_r.data or []
    if not rows:
        return None
    row = rows[0]
    if is_seed_bot_email(row.get("email")):
        return None
    my_tokens = int(row.get("tokens") or 100)
    masked = _masked_name(row.get("name"))
    try:
        all_r = (
            supabase.table("users")
            .select("id, email, tokens")
            .order("tokens", desc=True)
            .order("id")
            .execute()
        )
    except Exception as e:
        logger.warning("누적 칩 전체 순위 조회 실패: %s", e)
        return None
    rank = 0
    for r in all_r.data or []:
        if is_seed_bot_email(r.get("email")):
            continue
        rank += 1
        if str(r["id"]) == user_id:
            return {
                "user_id": user_id,
                "masked_name": masked,
                "score": my_tokens,
                "rank": rank,
            }
    return None


def _weekly_token_sums(
    supabase: Client,
    *,
    week_start: str,
    week_end: str,
) -> dict[str, int]:
    try:
        r = (
            supabase.table("survey_responses")
            .select("user_id, tokens_won")
            .gte("survey_date", week_start)
            .lte("survey_date", week_end)
            .not_.is_("tokens_won", "null")
            .execute()
        )
    except Exception as e:
        logger.warning("주간 칩 합계 조회 실패: %s", e)
        return {}
    sums: dict[str, int] = defaultdict(int)
    for row in r.data or []:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        try:
            sums[uid] += int(row.get("tokens_won") or 0)
        except (TypeError, ValueError):
            continue
    return dict(sums)


def find_my_weekly_token_entry(
    supabase: Client,
    user_id: str,
    *,
    week_start: str,
    week_end: str,
) -> dict[str, Any] | None:
    """이번 주 칩 획득 합계 기준 전체 순위·점수."""
    sums = _weekly_token_sums(supabase, week_start=week_start, week_end=week_end)
    sums.setdefault(user_id, 0)
    name_map = _fetch_name_map(supabase, list(sums.keys()))
    if user_id not in name_map:
        return None
    ranked = sorted(sums.items(), key=lambda x: (-x[1], x[0]))
    full: list[dict[str, Any]] = []
    for uid, score in ranked:
        if uid not in name_map:
            continue
        full.append({
            "user_id": uid,
            "masked_name": name_map[uid],
            "score": score,
        })
    return _my_entry_from_ranked(full, user_id)


def _full_accuracy_ranked(
    stats: dict[str, dict[str, int]],
    name_map: dict[str, str],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for uid, s in stats.items():
        if uid not in name_map:
            continue
        total = int(s.get("total") or 0)
        correct = int(s.get("correct") or 0)
        if total <= 0:
            continue
        pct = round(correct / total * 100)
        candidates.append({
            "user_id": uid,
            "masked_name": name_map[uid],
            "score": pct,
            "correct": correct,
            "total": total,
        })
    candidates.sort(key=lambda x: (-x["score"], -x["total"], x["user_id"]))
    return _assign_ranks(candidates)


def _my_accuracy_entry_with_placeholder(
    supabase: Client,
    user_id: str,
    stats: dict[str, dict[str, int]],
) -> dict[str, Any] | None:
    """상위 N 밖·이번 주/누적 집계 0일이어도 내 순위 행 반환(칩 순위와 동일 UX)."""
    uids = list({*stats.keys(), user_id})
    name_map = _fetch_name_map(supabase, uids)
    masked = name_map.get(user_id)
    if not masked:
        return None
    full = _full_accuracy_ranked(stats, name_map)
    found = _my_entry_from_ranked(full, user_id)
    if found:
        return found
    return {
        "user_id": user_id,
        "masked_name": masked,
        "score": 0,
        "correct": 0,
        "total": 0,
        "rank": len(full) + 1,
    }


def find_my_cumulative_accuracy_entry(
    supabase: Client,
    user_id: str,
) -> dict[str, Any] | None:
    try:
        _, _, user_scores = get_accuracy_data(supabase)
    except Exception as e:
        logger.warning("내 누적 적중률 순위 실패: %s", e)
        return None
    return _my_accuracy_entry_with_placeholder(supabase, user_id, user_scores)


def find_my_weekly_accuracy_entry(
    supabase: Client,
    user_id: str,
    *,
    week_start: str,
    week_end: str,
) -> dict[str, Any] | None:
    try:
        r = (
            supabase.table("accuracy_records")
            .select("user_id, kospi_correct")
            .gte("survey_date", week_start)
            .lte("survey_date", week_end)
            .execute()
        )
    except Exception as e:
        logger.warning("내 주간 적중률 순위 실패: %s", e)
        return None
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    for row in r.data or []:
        kc = _cell_truthy_bool(row.get("kospi_correct"))
        if kc is None:
            continue
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        stats[uid]["total"] += 1
        if kc:
            stats[uid]["correct"] += 1
    return _my_accuracy_entry_with_placeholder(supabase, user_id, dict(stats))


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
    week_start = monday.isoformat()
    week_end = sunday.isoformat()
    weekly = build_weekly_token_leaderboard(
        supabase,
        week_start=week_start,
        week_end=week_end,
        current_user_id=current_user_id,
        limit=limit,
    )
    accuracy_cumulative = build_cumulative_accuracy_leaderboard(supabase, limit=limit)
    accuracy_weekly = build_weekly_accuracy_leaderboard(
        supabase,
        week_start=week_start,
        week_end=week_end,
        limit=limit,
    )
    my_cumulative_entry = find_my_cumulative_token_entry(supabase, current_user_id)
    my_weekly_entry = find_my_weekly_token_entry(
        supabase,
        current_user_id,
        week_start=week_start,
        week_end=week_end,
    )
    my_accuracy_cumulative_entry = find_my_cumulative_accuracy_entry(
        supabase, current_user_id
    )
    my_accuracy_weekly_entry = find_my_weekly_accuracy_entry(
        supabase,
        current_user_id,
        week_start=week_start,
        week_end=week_end,
    )
    weekly_survivors = list_current_weekly_survivors(
        supabase,
        current_user_id=current_user_id,
    )
    return {
        "week_id": week_id,
        "week_start": week_start,
        "week_end": week_end,
        "weekly_survivors": weekly_survivors,
        "cumulative": cumulative,
        "weekly": weekly,
        "accuracy_cumulative": accuracy_cumulative,
        "accuracy_weekly": accuracy_weekly,
        "my_cumulative_rank": (
            _find_my_rank(cumulative, current_user_id)
            or (my_cumulative_entry or {}).get("rank")
        ),
        "my_weekly_rank": (
            _find_my_rank(weekly, current_user_id)
            or (my_weekly_entry or {}).get("rank")
        ),
        "my_accuracy_cumulative_rank": (
            _find_my_rank(accuracy_cumulative, current_user_id)
            or (my_accuracy_cumulative_entry or {}).get("rank")
        ),
        "my_accuracy_weekly_rank": (
            _find_my_rank(accuracy_weekly, current_user_id)
            or (my_accuracy_weekly_entry or {}).get("rank")
        ),
        "my_cumulative_entry": my_cumulative_entry,
        "my_weekly_entry": my_weekly_entry,
        "my_accuracy_cumulative_entry": my_accuracy_cumulative_entry,
        "my_accuracy_weekly_entry": my_accuracy_weekly_entry,
    }
