# -*- coding: utf-8 -*-
"""이번 주(월~금) 생존전 보드 — 대시보드 상단."""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from supabase import Client

from krx_calendar import is_krx_trading_day
from participation_rewards import is_seed_bot_email, today_kst_date, week_bounds_containing

logger = logging.getLogger(__name__)

WEEKDAY_LABELS = ["월", "화", "수", "목", "금"]


def _survey_date_key(d) -> str:
    if d is None:
        return ""
    if hasattr(d, "isoformat"):
        return str(d.isoformat())[:10]
    s = str(d).strip()
    return s[:10] if len(s) >= 10 else s


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
        return None
    if isinstance(v, (int, float)):
        if v == 1:
            return True
        if v == 0:
            return False
        return None
    return None


def _prediction_verdict(
    *,
    cal: date,
    today: date,
    is_trading: bool,
    submitted: bool,
    correct: bool | None,
) -> str:
    """none | pending | hit | miss"""
    if not is_trading:
        return "none"
    if not submitted:
        return "none"
    if cal > today:
        return "pending"
    if correct is None:
        return "pending"
    return "hit" if correct else "miss"


def _survival_status_for_day(
    *,
    cal: date,
    today: date,
    is_trading: bool,
    eliminated_before: bool,
    submitted: bool,
    correct: bool | None,
) -> str:
    """not_trading | pending | alive | eliminated | missed"""
    if not is_trading:
        return "not_trading"
    if eliminated_before:
        return "eliminated"
    if cal > today:
        return "pending"
    if not submitted:
        return "missed"
    if correct is None:
        return "pending"
    if correct:
        return "alive"
    return "eliminated"


def _user_week_survival_days(
    cal_dates: list[str],
    is_trading_map: dict[str, bool],
    today: date,
    responses: dict[str, bool],
    correct: dict[str, bool | None],
) -> tuple[bool, list[dict[str, Any]]]:
    eliminated = False
    days_out: list[dict[str, Any]] = []

    for cal_s in cal_dates:
        cal_d = date.fromisoformat(cal_s)
        is_trading = is_trading_map[cal_s]
        submitted = responses.get(cal_s, False)
        kc = correct.get(cal_s)

        if not is_trading:
            days_out.append({
                "calendar_date": cal_s,
                "survival": "not_trading",
                "prediction": "none",
                "submitted": False,
                "kospi_correct": None,
            })
            continue

        if eliminated:
            days_out.append({
                "calendar_date": cal_s,
                "survival": "eliminated",
                "prediction": _prediction_verdict(
                    cal=cal_d,
                    today=today,
                    is_trading=True,
                    submitted=submitted,
                    correct=kc,
                ),
                "submitted": submitted,
                "kospi_correct": kc,
            })
            continue

        survival = _survival_status_for_day(
            cal=cal_d,
            today=today,
            is_trading=True,
            eliminated_before=False,
            submitted=submitted,
            correct=kc,
        )
        if survival in ("missed", "eliminated"):
            eliminated = True

        days_out.append({
            "calendar_date": cal_s,
            "survival": survival,
            "prediction": _prediction_verdict(
                cal=cal_d,
                today=today,
                is_trading=True,
                submitted=submitted,
                correct=kc,
            ),
            "submitted": submitted,
            "kospi_correct": kc,
        })

    return not eliminated, days_out


def build_weekly_survival_board(supabase: Client, user_id: str) -> dict[str, Any]:
    today = today_kst_date()
    monday, _sunday, week_id = week_bounds_containing(today)

    cal_dates: list[str] = []
    is_trading_map: dict[str, bool] = {}
    columns: list[dict[str, Any]] = []

    for i in range(5):
        cal = monday + timedelta(days=i)
        cal_s = cal.isoformat()
        cal_dates.append(cal_s)
        is_td = is_krx_trading_day(cal)
        is_trading_map[cal_s] = is_td
        columns.append({
            "weekday_index": i,
            "label": WEEKDAY_LABELS[i],
            "calendar_date": cal_s,
            "is_trading_day": is_td,
            "is_future": cal > today,
            "kospi_result": None,
            "survivor_count": None,
        })

    trading_days_ordered = sorted(d for d in cal_dates if is_trading_map[d])

    kospi_by_date: dict[str, bool | None] = {}
    if cal_dates:
        try:
            ds = (
                supabase.table("daily_surveys")
                .select("survey_date, kospi_result")
                .in_("survey_date", cal_dates)
                .execute()
            )
            for row in ds.data or []:
                dk = _survey_date_key(row.get("survey_date"))
                kospi_by_date[dk] = _cell_truthy_bool(row.get("kospi_result"))
        except Exception as e:
            logger.warning("주간 생존: daily_surveys 조회 실패: %s", e)

    for col in columns:
        dk = col["calendar_date"]
        col["kospi_result"] = kospi_by_date.get(dk)

    responses_by_user: dict[str, dict[str, bool]] = defaultdict(dict)
    correct_by_user: dict[str, dict[str, bool | None]] = defaultdict(dict)

    if trading_days_ordered:
        try:
            resp_r = (
                supabase.table("survey_responses")
                .select("user_id, survey_date, kospi_answer")
                .in_("survey_date", trading_days_ordered)
                .execute()
            )
            for row in resp_r.data or []:
                uid = str(row.get("user_id") or "")
                dk = _survey_date_key(row.get("survey_date"))
                if not uid or not dk:
                    continue
                responses_by_user[uid][dk] = True
                ka = _cell_truthy_bool(row.get("kospi_answer"))
                kr = kospi_by_date.get(dk)
                if ka is not None and kr is not None:
                    correct_by_user[uid][dk] = ka == kr
        except Exception as e:
            logger.warning("주간 생존: survey_responses 조회 실패: %s", e)

        try:
            acc_r = (
                supabase.table("accuracy_records")
                .select("user_id, survey_date, kospi_correct")
                .in_("survey_date", trading_days_ordered)
                .execute()
            )
            for row in acc_r.data or []:
                uid = str(row.get("user_id") or "")
                dk = _survey_date_key(row.get("survey_date"))
                if not uid or not dk:
                    continue
                kc = _cell_truthy_bool(row.get("kospi_correct"))
                if kc is not None:
                    correct_by_user[uid][dk] = kc
        except Exception as e:
            logger.warning("주간 생존: accuracy_records 조회 실패: %s", e)

    all_user_ids = list(responses_by_user.keys())
    seed_uids: set[str] = set()
    if all_user_ids:
        try:
            users_r = (
                supabase.table("users")
                .select("id, email")
                .in_("id", all_user_ids)
                .execute()
            )
            for row in users_r.data or []:
                if is_seed_bot_email(row.get("email")):
                    seed_uids.add(str(row["id"]))
        except Exception as e:
            logger.warning("주간 생존: users 조회 실패: %s", e)

    real_users = [uid for uid in all_user_ids if uid not in seed_uids]

    def _day_fully_settled(td: str) -> bool:
        if td > today.isoformat():
            return False
        if kospi_by_date.get(td) is None:
            return False
        prior = [d for d in trading_days_ordered if d <= td]
        return all(kospi_by_date.get(d) is not None for d in prior if d <= today.isoformat())

    def _user_alive_through(uid: str, through_date: str) -> bool:
        for d in trading_days_ordered:
            if d > through_date:
                break
            if d > today.isoformat():
                break
            if not responses_by_user.get(uid, {}).get(d):
                return False
            c = correct_by_user.get(uid, {}).get(d)
            if c is None:
                return False
            if not c:
                return False
        return True

    survivor_count_by_date: dict[str, int | None] = {}
    for td in trading_days_ordered:
        if not _day_fully_settled(td):
            survivor_count_by_date[td] = None
            continue
        survivor_count_by_date[td] = sum(
            1 for uid in real_users if _user_alive_through(uid, td)
        )

    for col in columns:
        dk = col["calendar_date"]
        if is_trading_map.get(dk):
            col["survivor_count"] = survivor_count_by_date.get(dk)

    current_survivors: int | None = None
    for td in reversed(trading_days_ordered):
        sc = survivor_count_by_date.get(td)
        if sc is not None:
            current_survivors = sc
            break

    cohort_size: int | None = None
    if trading_days_ordered:
        first_td = trading_days_ordered[0]
        if first_td <= today.isoformat():
            cohort_size = sum(
                1 for uid in real_users
                if responses_by_user.get(uid, {}).get(first_td)
            )

    my_responses = responses_by_user.get(user_id, {})
    my_correct = correct_by_user.get(user_id, {})
    my_alive, my_days = _user_week_survival_days(
        cal_dates,
        is_trading_map,
        today,
        my_responses,
        my_correct,
    )
    my_by_date = {d["calendar_date"]: d for d in my_days}

    for col in columns:
        dk = col["calendar_date"]
        mine = my_by_date.get(dk, {})
        col["my_prediction"] = mine.get("prediction", "none")
        col["my_survival"] = mine.get("survival", "not_trading")

    return {
        "week_id": week_id,
        "week_start": monday.isoformat(),
        "today": today.isoformat(),
        "current_survivors": current_survivors,
        "cohort_size": cohort_size,
        "my_alive": my_alive,
        "columns": columns,
    }
