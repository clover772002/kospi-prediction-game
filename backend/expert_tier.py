# -*- coding: utf-8 -*-
"""전역 최고 고수(누적 적중 1순위) — 고수 탭·아이템 고수층 공통 정의."""
from __future__ import annotations

import logging
from datetime import datetime

from supabase import Client

from accuracy_aggregate import bayesian_accuracy, get_accuracy_data
from krx_calendar import KST, last_n_trading_days_inclusive_through

logger = logging.getLogger(__name__)

SEGMENT_PRED_COUNT_MIN = 5
# 최근 N거래일 안 확정 적중 기록 1건 이상 — 장기 미참여 고수 고정 방지
RECENT_TRADING_DAYS_FOR_EXPERT = 14


def _bayesian_rate_for_user(user_scores: dict, uid: str) -> float:
    s = user_scores.get(uid) or {"correct": 0, "total": 0}
    return bayesian_accuracy(int(s.get("correct") or 0), int(s.get("total") or 0))


def _uids_with_accuracy_in_recent_trading_days(supabase: Client, n_days: int) -> set[str]:
    end_d = datetime.now(KST).date()
    try:
        dates = last_n_trading_days_inclusive_through(end_d, n_days)
    except ValueError:
        return set()
    if not dates:
        return set()
    date_strs = [c.isoformat() for c in dates]
    try:
        res = (
            supabase.table("accuracy_records")
            .select("user_id")
            .in_("survey_date", date_strs)
            .execute()
        )
    except Exception as e:
        logger.warning("최근 거래일 적중 기록 조회 실패: %s", e)
        return set()
    return {str(r["user_id"]) for r in (res.data or []) if r.get("user_id") is not None}


def global_top_expert_uid(supabase: Client) -> tuple[str | None, str | None]:
    """
    최고 고수: 예측 ≥ SEGMENT_PRED_COUNT_MIN, 최근 RECENT_TRADING_DAYS_FOR_EXPERT 거래일 내
    확정 기록 1건 이상, 베이지안 보정 적중률(α=BAYES_ALPHA) 1순위(동률 시 id순).
    """
    acc_map, pred_count, user_scores = get_accuracy_data(supabase)
    recent_active = _uids_with_accuracy_in_recent_trading_days(
        supabase, RECENT_TRADING_DAYS_FOR_EXPERT
    )

    eligible = [
        str(uid)
        for uid in pred_count
        if int(pred_count.get(uid, 0) or 0) >= SEGMENT_PRED_COUNT_MIN
        and str(uid) in recent_active
    ]
    if not eligible:
        return None, "segment_empty"

    def rank_score(u: str) -> float:
        return _bayesian_rate_for_user(user_scores, u)

    leader = sorted(eligible, key=lambda u: (-rank_score(u), u))[0]
    return leader, None


def global_top_expert_ids_on_day(day_user_ids: set[str], leader_uid: str | None) -> set[str]:
    """그날 설문에 참여한 전역 최고 고수만(0 또는 1명)."""
    if not leader_uid or leader_uid not in day_user_ids:
        return set()
    return {leader_uid}


def leader_display_accuracy_pct(user_scores: dict, uid: str) -> int:
    """카드·UI용 — 고수 선정과 동일한 베이지안 보정 %."""
    return round(_bayesian_rate_for_user(user_scores, uid) * 100)
