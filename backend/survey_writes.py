# -*- coding: utf-8 -*-
"""설문 응답 저장: 1인 1거래일 1건 + 재투표 grant 등."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)


class SurveySubmissionLocked(Exception):
    """잠금 상태에서 재전송 차단."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_pending_grant(supabase: Client, user_id: str, survey_date: str) -> dict | None:
    try:
        r = (
            supabase.table("survey_response_edit_grant")
            .select("id, grant_kind")
            .eq("user_id", user_id)
            .eq("survey_date", survey_date)
            .is_("consumed_at", "null")
            .limit(1)
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning(f"survey_response_edit_grant 조회 실패(테이블 미적용?): {e}")
        return None


def consume_grant_by_id(supabase: Client, grant_id: str) -> None:
    supabase.table("survey_response_edit_grant").update({"consumed_at": _iso_now()}).eq("id", grant_id).execute()


def cancel_active_presubmit_for_date(supabase: Client, user_id: str, survey_date: str) -> None:
    try:
        supabase.table("survey_vote_presubmit").update({"canceled_at": _iso_now()}).eq("user_id", user_id).eq(
            "survey_date", survey_date
        ).is_("applied_at", "null").is_("canceled_at", "null").execute()
    except Exception as e:
        logger.warning(f"presubmit cancel skip: {e}")


def has_pending_grant(supabase: Client, user_id: str, survey_date: str) -> bool:
    return fetch_pending_grant(supabase, user_id, survey_date) is not None


def _row_gauge(row: dict[str, Any]) -> int:
    gp = row.get("gauge_position")
    if gp is None:
        return 50 if row.get("kospi_answer") else -50
    return int(gp)


def _bet_and_payload(
    supabase: Client, user_id: str, survey_date: str, gauge_position: int
) -> dict[str, Any]:
    urow = supabase.table("users").select("tokens").eq("id", user_id).execute()
    current_tokens = int(urow.data[0]["tokens"]) if urow.data else 100
    tokens_bet = max(1, round(abs(gauge_position) / 100 * current_tokens))
    kospi_answer = gauge_position > 0
    return {
        "user_id": user_id,
        "survey_date": survey_date,
        "kospi_answer": bool(kospi_answer),
        "kosdaq_answer": False,
        "gauge_position": gauge_position,
        "tokens_bet": tokens_bet,
        "tokens_before": current_tokens,
    }


def persist_survey_answer(
    supabase: Client,
    user_id: str,
    target_date: str,
    gauge_position: int,
    *,
    survey_closed: bool,
) -> dict[str, Any]:
    """첫 응답은 INSERT. 이후 같은 방향 확신도 변경은 마감·정산 전 무료. 방향 변경은 redo_full grant."""
    if survey_closed:
        raise ValueError("설문이 마감됐습니다.")

    payload = _bet_and_payload(supabase, user_id, target_date, gauge_position)
    tokens_bet = payload["tokens_bet"]
    current_tokens = payload["tokens_before"]

    existing = (
        supabase.table("survey_responses")
        .select("user_id, gauge_position, kospi_answer, tokens_won")
        .eq("user_id", user_id)
        .eq("survey_date", target_date)
        .limit(1)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        if row.get("tokens_won") is not None:
            raise SurveySubmissionLocked("이미 결과가 정산된 거래일은 확신도를 수정할 수 없습니다.")

        old_gp = _row_gauge(row)
        same_direction = (old_gp < 0) == (gauge_position < 0)

        if same_direction:
            supabase.table("survey_responses").update(payload).eq("user_id", user_id).eq(
                "survey_date", target_date
            ).execute()
        else:
            grant = fetch_pending_grant(supabase, user_id, target_date)
            if not grant or grant["grant_kind"] != "redo_full":
                raise SurveySubmissionLocked(
                    "상승/하락 방향을 바꾸려면 상점 「재투표 1회」 또는 「방향만 반전」 권한이 필요해요. "
                    "확신도만 바꿀 때는 같은 방향에서 게이지를 조정한 뒤 「확신도 저장」을 눌러 주세요."
                )
            supabase.table("survey_responses").update(payload).eq("user_id", user_id).eq(
                "survey_date", target_date
            ).execute()
            consume_grant_by_id(supabase, grant["id"])
    else:
        supabase.table("survey_responses").insert(payload).execute()
        cancel_active_presubmit_for_date(supabase, user_id, target_date)

    return {"tokens_bet": tokens_bet, "current_tokens": current_tokens, "survey_date": target_date}


def apply_gauge_adjust_once(
    supabase: Client,
    user_id: str,
    survey_date: str,
    new_gauge: int,
    *,
    survey_closed: bool,
) -> dict[str, Any]:
    if survey_closed:
        raise ValueError("설문이 마감됐습니다.")
    if not (-100 <= new_gauge <= 100) or new_gauge == 0:
        raise ValueError("gauge_position은 -100~100 범위의 0이 아닌 값이어야 합니다.")

    res = (
        supabase.table("survey_responses")
        .select("gauge_position, kospi_answer, tokens_won")
        .eq("user_id", user_id)
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ValueError("먼저 설문에 응답해 주세요.")

    row = res.data[0]
    if row.get("tokens_won") is not None:
        raise ValueError("이미 결과가 정산된 거래일은 확신도를 수정할 수 없습니다.")

    old_gp = _row_gauge(row)

    if (old_gp < 0) != (new_gauge < 0):
        raise ValueError("방향이 같은 경우에만 게이지만 조정할 수 있습니다.")

    payload = _bet_and_payload(supabase, user_id, survey_date, new_gauge)
    supabase.table("survey_responses").update(payload).eq("user_id", user_id).eq("survey_date", survey_date).execute()

    grant = fetch_pending_grant(supabase, user_id, survey_date)
    if grant and grant["grant_kind"] == "gauge_only":
        consume_grant_by_id(supabase, grant["id"])

    return {"tokens_bet": payload["tokens_bet"], "current_tokens": payload["tokens_before"], "survey_date": survey_date}


def apply_direction_flip_once(
    supabase: Client,
    user_id: str,
    survey_date: str,
    *,
    survey_closed: bool,
) -> dict[str, Any]:
    if survey_closed:
        raise ValueError("설문이 마감됐습니다.")

    res = (
        supabase.table("survey_responses")
        .select("gauge_position, kospi_answer")
        .eq("user_id", user_id)
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ValueError("먼저 설문에 응답해 주세요.")

    row = res.data[0]
    old_gp = row.get("gauge_position")
    if old_gp is None:
        old_gp = 50 if row["kospi_answer"] else -50
    old_gp = int(old_gp)
    if old_gp == 0:
        raise ValueError("플립할 게이지가 없습니다.")

    grant = fetch_pending_grant(supabase, user_id, survey_date)
    if not grant or grant["grant_kind"] != "flip_direction":
        raise ValueError('「방향만 반전」권한이 필요합니다. 상점에서 구매 후 다시 시도해 주세요.')

    new_gp = -old_gp
    payload = _bet_and_payload(supabase, user_id, survey_date, new_gp)
    supabase.table("survey_responses").update(payload).eq("user_id", user_id).eq("survey_date", survey_date).execute()
    consume_grant_by_id(supabase, grant["id"])
    return {"tokens_bet": payload["tokens_bet"], "current_tokens": payload["tokens_before"], "survey_date": survey_date}


def apply_pending_presubmits(supabase: Client, user_id: str) -> list[str]:
    """예약건을 설문이 열려 있고 무응답일 때 제출 처리."""
    try:
        rows = (
            supabase.table("survey_vote_presubmit")
            .select("id, survey_date, gauge_position")
            .eq("user_id", user_id)
            .is_("canceled_at", "null")
            .is_("applied_at", "null")
            .execute()
        )
    except Exception as e:
        logger.warning(f"survey_vote_presubmit 조회 실패: {e}")
        return []

    applied: list[str] = []
    for pr in rows.data or []:
        sd = pr["survey_date"]
        gauge_position = int(pr["gauge_position"])
        ds = supabase.table("daily_surveys").select("is_closed").eq("survey_date", sd).execute()
        if not ds.data:
            continue
        if ds.data[0]["is_closed"]:
            continue

        answered = (
            supabase.table("survey_responses")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("survey_date", sd)
            .limit(1)
            .execute()
        )
        if answered.data:
            supabase.table("survey_vote_presubmit").update({"canceled_at": _iso_now()}).eq("id", pr["id"]).execute()
            continue

        payload = _bet_and_payload(supabase, user_id, sd, gauge_position)
        try:
            supabase.table("survey_responses").insert(payload).execute()
            supabase.table("survey_vote_presubmit").update({"applied_at": _iso_now()}).eq("id", pr["id"]).execute()
            applied.append(sd)
            logger.info(f"예약 설문 적용 user={user_id} date={sd}")
        except Exception as e:
            logger.warning(f"예약 설문 적용 실패 user={user_id} date={sd}: {e}")
    return applied
