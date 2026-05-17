# -*- coding: utf-8 -*-
"""전역 최고 고수(누적 적중 1순위) — 고수 탭·아이템 고수층 공통 정의."""
from __future__ import annotations

from supabase import Client

from accuracy_aggregate import get_accuracy_data

SEGMENT_PRED_COUNT_MIN = 5


def global_top_expert_uid(supabase: Client) -> tuple[str | None, str | None]:
    """예측 횟수 규격 통과자 중 누적 적중률 1순위(동률 시 id순). 없으면 segment_empty."""
    acc_map, pred_count, _ = get_accuracy_data(supabase)
    eligible = [
        str(uid)
        for uid in pred_count
        if int(pred_count.get(uid, 0) or 0) >= SEGMENT_PRED_COUNT_MIN
    ]
    if not eligible:
        return None, "segment_empty"

    def acc_of(u: str) -> float:
        return float(acc_map.get(u, 0.5))

    leader = sorted(eligible, key=lambda u: (-acc_of(u), u))[0]
    return leader, None


def global_top_expert_ids_on_day(day_user_ids: set[str], leader_uid: str | None) -> set[str]:
    """그날 설문에 참여한 전역 최고 고수만(0 또는 1명)."""
    if not leader_uid or leader_uid not in day_user_ids:
        return set()
    return {leader_uid}
