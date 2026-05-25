# -*- coding: utf-8 -*-
"""대시보드 payload — summary(빠른 첫 화면) / full(전체 이력·랭킹)."""
from __future__ import annotations

import logging
from typing import Any

from supabase import Client

from accuracy_aggregate import get_accuracy_data
from survey_writes import apply_pending_presubmits

logger = logging.getLogger(__name__)


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


def build_user_dashboard(
    supabase: Client,
    user_id: str,
    *,
    history_limit: int = 30,
    include_rank_stats: bool = True,
    settle_pending: bool = False,
    settle_fn=None,
) -> dict[str, Any]:
    """
    settle_fn: main._settle_kospi_tokens_for_user_date (순환 import 방지용 주입).
    """
    try:
        apply_pending_presubmits(supabase, user_id)
    except Exception as ex:
        logger.warning("대시보드: 예약 설문 적용 스킵 — %s", ex)

    user_row = supabase.table("users").select("tokens, current_streak").eq("id", user_id).execute()
    user_tokens = user_row.data[0].get("tokens", 100) if user_row.data else 100
    user_streak = user_row.data[0].get("current_streak", 0) if user_row.data else 0

    lim = max(1, min(int(history_limit), 30))
    my_responses = (
        supabase.table("survey_responses")
        .select("survey_date, kospi_answer, gauge_position, tokens_bet, tokens_won, payout_multiplier")
        .eq("user_id", user_id)
        .order("survey_date", desc=True)
        .limit(lim)
        .execute()
    )

    my_accuracy_res = (
        supabase.table("accuracy_records")
        .select("survey_date, kospi_correct")
        .eq("user_id", user_id)
        .execute()
    )

    accuracy_map = {_survey_date_key(r["survey_date"]): r for r in (my_accuracy_res.data or [])}
    responses_rows = my_responses.data or []

    unique_dates_raw = list(
        {_survey_date_key(resp["survey_date"]) for resp in responses_rows if resp.get("survey_date") is not None}
    )
    unique_dates_raw = [d for d in unique_dates_raw if len(d) >= 8]
    kospi_result_by_date: dict[str, bool | None] = {}
    kospi_pct_by_date: dict[str, float | None] = {}

    if unique_dates_raw:
        ds_bulk = (
            supabase.table("daily_surveys")
            .select("survey_date, kospi_result, kospi_change_pct")
            .in_("survey_date", unique_dates_raw)
            .execute()
        )
        for row in ds_bulk.data or []:
            dk = _survey_date_key(row["survey_date"])
            kospi_result_by_date[dk] = _cell_truthy_bool(row.get("kospi_result"))
            raw_pct = row.get("kospi_change_pct")
            pct_val = None
            if raw_pct is not None:
                try:
                    pct_val = round(float(raw_pct), 4)
                except (TypeError, ValueError):
                    pct_val = None
            kospi_pct_by_date[dk] = pct_val

    if settle_pending and settle_fn is not None:
        pending_settle_dates = sorted({
            _survey_date_key(resp["survey_date"])
            for resp in responses_rows
            if resp.get("tokens_won") is None and resp.get("survey_date") is not None
        })
        pending_settle_dates = [
            d for d in pending_settle_dates
            if len(d) >= 8 and kospi_result_by_date.get(d) is not None
        ]
        if len(pending_settle_dates) > 3:
            pending_settle_dates = pending_settle_dates[-3:]
        user_tokens_settled = False
        for d in pending_settle_dates:
            if settle_fn(supabase, user_id, d, bool(kospi_result_by_date[d])):
                user_tokens_settled = True
        if user_tokens_settled:
            user_row = supabase.table("users").select("tokens, current_streak").eq("id", user_id).execute()
            user_tokens = user_row.data[0].get("tokens", 100) if user_row.data else user_tokens
            user_streak = user_row.data[0].get("current_streak", 0) if user_row.data else user_streak
            my_responses = (
                supabase.table("survey_responses")
                .select("survey_date, kospi_answer, gauge_position, tokens_bet, tokens_won, payout_multiplier")
                .eq("user_id", user_id)
                .order("survey_date", desc=True)
                .limit(lim)
                .execute()
            )
            responses_rows = my_responses.data or []

    history: list[dict[str, Any]] = []
    for resp in responses_rows:
        d_key = _survey_date_key(resp["survey_date"])
        acc = accuracy_map.get(d_key, {})
        kospi_correct = acc.get("kospi_correct")
        if kospi_correct is not None:
            kospi_correct = _cell_truthy_bool(kospi_correct)
        kr = kospi_result_by_date.get(d_key)
        ka = _cell_truthy_bool(resp.get("kospi_answer"))
        if kospi_correct is None and ka is not None and kr is not None:
            kospi_correct = ka == kr

        history.append({
            "date": d_key or resp["survey_date"],
            "kospi_answer": resp["kospi_answer"],
            "kospi_correct": kospi_correct,
            "kospi_market_result": kr,
            "kospi_change_pct": kospi_pct_by_date.get(d_key),
            "gauge_position": resp.get("gauge_position"),
            "tokens_bet": resp.get("tokens_bet"),
            "tokens_won": resp.get("tokens_won"),
            "payout_multiplier": resp.get("payout_multiplier"),
        })

    total_predictions = len(responses_rows)
    try:
        cnt_res = (
            supabase.table("survey_responses")
            .select("id", count="exact", head=True)
            .eq("user_id", user_id)
            .execute()
        )
        if cnt_res.count is not None:
            total_predictions = int(cnt_res.count)
    except Exception:
        pass

    # 누적 적중률: 전체 accuracy_records 기준 (history_limit 과 분리 — 요약 5일만 쓰면 %가 깜빡임)
    acc_stats_total = 0
    acc_stats_correct = 0
    for acc in accuracy_map.values():
        kc = _cell_truthy_bool(acc.get("kospi_correct"))
        if kc is not None:
            acc_stats_total += 1
            if kc:
                acc_stats_correct += 1

    history_with_result = sum(1 for h in history if h["kospi_correct"] is not None)
    history_correct = sum(1 for h in history if h["kospi_correct"])

    base: dict[str, Any] = {
        "accuracy": {"kospi": None, "overall": None},
        "percentile": None,
        "contribution": None,
        "history": history,
        "total_predictions": total_predictions,
        "tokens": user_tokens,
        "current_streak": user_streak,
        "history_truncated": lim < 30,
    }

    if acc_stats_total > 0:
        kospi_correct_cnt = acc_stats_correct
        total_with_result = acc_stats_total
    elif history_with_result > 0:
        kospi_correct_cnt = history_correct
        total_with_result = history_with_result
    else:
        return base

    kospi_acc = round(kospi_correct_cnt / total_with_result * 100)
    base["accuracy"] = {"kospi": kospi_acc, "overall": kospi_acc}

    if not include_rank_stats:
        return base

    try:
        _, _, user_scores = get_accuracy_data(supabase)
        my_rate = kospi_correct_cnt / total_with_result
        users_with_lower = sum(
            1 for uid, s in user_scores.items()
            if s["total"] > 0 and s["correct"] / s["total"] < my_rate
        )
        total_users = len(user_scores)
        base["percentile"] = round((1 - users_with_lower / total_users) * 100) if total_users > 1 else 100
        all_rates = [s["correct"] / s["total"] for s in user_scores.values() if s["total"] > 0]
        avg_rate = sum(all_rates) / len(all_rates) if all_rates else 0.5
        base["contribution"] = round(my_rate / avg_rate * 100) if avg_rate > 0 else 100
    except Exception as ex:
        logger.warning("대시보드: 상위 퍼센트·기여도 계산 스킵 — %s", ex)

    return base
