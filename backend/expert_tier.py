# -*- coding: utf-8 -*-
"""전역 고수(토큰 1위) — 고수 탭·아이템·집계 카드 공통 정의."""
from __future__ import annotations

import logging

from supabase import Client

logger = logging.getLogger(__name__)

# 하수층·wave_b 세그먼트용(고수 선정과 무관)
SEGMENT_PRED_COUNT_MIN = 5


def _fetch_user_token_balance(supabase: Client, user_id: str) -> int:
    try:
        row = (
            supabase.table("users")
            .select("tokens")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if row.data:
            return int(row.data[0].get("tokens") or 100)
    except Exception as e:
        logger.warning("users.tokens 조회 실패 uid=%s: %s", user_id, e)
    return 100


def global_top_expert_uid(supabase: Client) -> tuple[str | None, str | None]:
    """보유 토큰이 가장 많은 참가자 1명(동률 시 id순). users 행이 없으면 segment_empty."""
    try:
        res = (
            supabase.table("users")
            .select("id, tokens")
            .order("tokens", desc=True)
            .order("id")
            .limit(50)
            .execute()
        )
    except Exception as e:
        logger.warning("고수(토큰 1위) 조회 실패: %s", e)
        return None, "segment_empty"

    rows = res.data or []
    if not rows:
        return None, "segment_empty"

    top_tokens = int(rows[0].get("tokens") or 100)
    tied = [r for r in rows if int(r.get("tokens") or 100) == top_tokens]
    leader = sorted(str(r["id"]) for r in tied)[0]
    return leader, None


def global_top_expert_ids_on_day(day_user_ids: set[str], leader_uid: str | None) -> set[str]:
    """그날 설문에 참여한 전역 고수만(0 또는 1명)."""
    if not leader_uid or leader_uid not in day_user_ids:
        return set()
    return {leader_uid}


def leader_token_balance(supabase: Client, uid: str) -> int:
    """카드·UI용 — 해당 참가자 현재 토큰 잔액."""
    return _fetch_user_token_balance(supabase, uid)
