# -*- coding: utf-8 -*-
"""
accuracy_records 를 유저별 집계해 가중 예측·백분위 등에 사용합니다.

- 1차: Postgres RPC `get_kospi_accuracy_aggregates` (서버에서 GROUP BY, 네트워크·CPU 절약)
- 폴백: 기존 range 페이지 조회 (RPC 미배포·오류 시)
"""
from __future__ import annotations

import logging
import time

from supabase import Client

logger = logging.getLogger(__name__)

_acc_cache: dict = {"map": {}, "count": {}, "scores": {}, "ts": 0.0}
_ACC_CACHE_TTL = 300  # 5분 캐시 (main.py 와 동일 정책)

# main._calc_weighted_pct 와 동일 — 표본 적을 때 50% 쪽으로 수렴
BAYES_ALPHA = 5


def bayesian_accuracy(correct: int, total: int, *, alpha: int = BAYES_ALPHA) -> float:
    """(맞힌 수 + α) / (전체 + 2α). total=0 이면 0.5."""
    if total <= 0:
        return 0.5
    return (correct + alpha) / (total + 2 * alpha)


def clear_accuracy_cache() -> None:
    """accuracy_records 가 바뀐 뒤(정산·15:35 등) 캐시 무효화."""
    _acc_cache["map"] = {}
    _acc_cache["count"] = {}
    _acc_cache["scores"] = {}
    _acc_cache["ts"] = 0.0


def _build_maps_from_user_scores(user_scores: dict) -> tuple[dict, dict, dict]:
    acc_map = {uid: s["correct"] / s["total"] for uid, s in user_scores.items() if s["total"] > 0}
    pred_count = {uid: s["total"] for uid, s in user_scores.items()}
    return acc_map, pred_count, user_scores


def _fetch_via_rpc(supabase: Client) -> dict | None:
    """RPC 성공 시 user_scores(dict) 또는 빈 dict. 실패 시 None."""
    try:
        res = supabase.rpc("get_kospi_accuracy_aggregates", {}).execute()
        rows = res.data
        if rows is None:
            return {}
        if not isinstance(rows, list):
            logger.warning("RPC get_kospi_accuracy_aggregates: data 형식 예상 외 (%s)", type(rows))
            return None
        user_scores: dict = {}
        for row in rows:
            uid = row.get("user_id")
            if uid is None:
                continue
            # UUID / str 혼용 시 문자열로 통일
            key = str(uid)
            c = int(row.get("correct") or 0)
            t = int(row.get("total") or 0)
            user_scores[key] = {"correct": c, "total": t}
        return user_scores
    except Exception as e:
        logger.warning("get_kospi_accuracy_aggregates RPC 실패: %s", e)
        return None


def _fetch_via_pagination(supabase: Client) -> dict:
    user_scores: dict = {}
    batch_size = 1000
    offset = 0
    while True:
        batch = (
            supabase.table("accuracy_records")
            .select("user_id, kospi_correct")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        rows = batch.data or []
        if not rows:
            break
        for r in rows:
            uid = str(r["user_id"])
            if uid not in user_scores:
                user_scores[uid] = {"correct": 0, "total": 0}
            user_scores[uid]["correct"] += 1 if r.get("kospi_correct") else 0
            user_scores[uid]["total"] += 1
        if len(rows) < batch_size:
            break
        offset += batch_size
    return user_scores


def get_accuracy_data(supabase: Client) -> tuple[dict, dict, dict]:
    """(acc_map, pred_count, user_scores) 반환. user_scores[uid] = correct/total 딕셔너리."""
    now = time.time()
    if now - _acc_cache["ts"] < _ACC_CACHE_TTL and _acc_cache["map"]:
        return _acc_cache["map"], _acc_cache["count"], _acc_cache["scores"]

    user_scores = _fetch_via_rpc(supabase)
    if user_scores is None:
        logger.info("정확도 집계: RPC 불가 → accuracy_records 페이지 폴백")
        user_scores = _fetch_via_pagination(supabase)

    acc_map, pred_count, _t = _build_maps_from_user_scores(user_scores)

    _acc_cache["map"] = acc_map
    _acc_cache["count"] = pred_count
    _acc_cache["scores"] = user_scores
    _acc_cache["ts"] = now
    return acc_map, pred_count, user_scores
