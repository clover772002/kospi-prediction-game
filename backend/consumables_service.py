# -*- coding: utf-8 -*-
"""소모품 구매 처리(설문 수정 권한·연승·레이크백)."""

from __future__ import annotations

import logging
from typing import Any

from supabase import Client

from consumables_catalog import CONSUMABLE_PRODUCTS
from krx_calendar import today_date_kst
from survey_writes import has_pending_grant
from token_wallet import grant_tokens_with_ledger, ledger_exists_by_idempotency, spend_tokens_idempotent

logger = logging.getLogger(__name__)


SLUG_TO_GRANT_KIND = {
    "vote_redo_once": "redo_full",
    "gauge_adjust_keep_direction_once": "gauge_only",
    "direction_flip_keep_magnitude_once": "flip_direction",
}

_TODAY_BOUND_EDIT_SLUGS = frozenset(SLUG_TO_GRANT_KIND.keys())


def purchase_consumable(
    supabase: Client,
    user_id: str,
    slug: str,
    *,
    idempotency_key: str,
    survey_date: str | None = None,
    gauge_position: int | None = None,
) -> dict[str, Any]:
    """소모품 1종 구매. 실패 시 dict ok False / 성공 시 ok True."""
    if slug not in CONSUMABLE_PRODUCTS:
        return {"ok": False, "error": "unknown_slug", "message": "알 수 없는 상품입니다."}

    meta = CONSUMABLE_PRODUCTS[slug]
    cost = int(meta["price_tokens"])
    nd = meta.get("requires_survey_date", False)

    if slug in _TODAY_BOUND_EDIT_SLUGS:
        sd = today_date_kst().isoformat()
    elif nd and (not survey_date or not survey_date.strip()):
        return {"ok": False, "error": "survey_date_required", "message": "거래일(survey_date)이 필요합니다."}
    else:
        sd = survey_date.strip() if survey_date else ""

    try:
        if slug.startswith("rakeback_"):
            return _purchase_rakeback(supabase, user_id, slug, sd, cost, idempotency_key=idempotency_key)
        if slug == "streak_protect_next_miss":
            return _purchase_streak_shield(supabase, user_id, slug, cost, idempotency_key=idempotency_key)
        if slug not in SLUG_TO_GRANT_KIND:
            return {"ok": False, "error": "invalid_internal", "message": "미구현 상품입니다."}

        grant_kind = SLUG_TO_GRANT_KIND[slug]
        return _purchase_edit_grant(supabase, user_id, sd, slug, grant_kind, cost, idempotency_key=idempotency_key)
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("purchase_consumable")
        return {"ok": False, "error": "server", "message": str(e)}


def _purchase_edit_grant(
    supabase: Client,
    user_id: str,
    survey_date: str,
    slug: str,
    grant_kind: str,
    cost: int,
    *,
    idempotency_key: str,
) -> dict[str, Any]:
    debit_key = f"{idempotency_key}:buy:{slug}:{survey_date}"
    ds = supabase.table("daily_surveys").select("is_closed").eq("survey_date", survey_date).execute()
    if not ds.data:
        return {"ok": False, "error": "bad_date", "message": "해당 날짜의 설문이 없습니다."}
    if ds.data[0]["is_closed"]:
        return {"ok": False, "error": "closed", "message": "설문이 이미 마감된 거래일입니다."}

    if has_pending_grant(supabase, user_id, survey_date):
        return {
            "ok": False,
            "error": "pending_grant_exists",
            "message": "이미 이 거래일에 사용 대기 중인 수정 권한이 있습니다. 먼저 사용하거나 정산 후 다시 확인해 주세요.",
        }

    spend = spend_tokens_idempotent(
        supabase,
        user_id,
        amount=cost,
        reason="consumable_purchase",
        ref_type="consumable",
        ref_id=f"{slug}:{survey_date}",
        idempotency_key=debit_key,
    )
    if not spend.get("ok"):
        return {
            "ok": False,
            "error": spend.get("error", "payment_failed"),
            "required": spend.get("required", cost),
            "balance": spend.get("balance", 0),
        }

    try:
        supabase.table("survey_response_edit_grant").insert(
            {"user_id": user_id, "survey_date": survey_date, "grant_kind": grant_kind}
        ).execute()
    except Exception as e:
        logger.error(f"grant insert 실패 — 환급 필요 user={user_id} slug={slug}: {e}")
        try:
            grant_tokens_with_ledger(
                supabase,
                user_id,
                delta=cost,
                reason="consumable_refund_grant_insert_fail",
                ref_type="consumable",
                ref_id=slug + ":" + survey_date,
                idempotency_key=debit_key + ":refund",
            )
        except Exception as e2:
            logger.exception(f"consumable 환급 실패 수동 처리 user={user_id}: {e2}")
        return {"ok": False, "error": "grant_insert_failed", "message": str(e)}

    return {"ok": True, "balance": spend.get("balance"), "spent": cost, "survey_date": survey_date, "grant_kind": grant_kind}


def _purchase_streak_shield(
    supabase: Client,
    user_id: str,
    slug: str,
    cost: int,
    *,
    idempotency_key: str,
) -> dict[str, Any]:
    debit_key = f"{idempotency_key}:buy:{slug}"
    if ledger_exists_by_idempotency(supabase, user_id, debit_key):
        u = supabase.table("users").select("tokens, streak_shield_charges").eq("id", user_id).execute()
        row = u.data[0] if u.data else {}
        return {"ok": True, "spent": False, "balance": int(row.get("tokens") or 100), "charges": int(row.get("streak_shield_charges") or 0)}

    spend = spend_tokens_idempotent(
        supabase,
        user_id,
        amount=cost,
        reason="consumable_purchase",
        ref_type="consumable",
        ref_id=slug,
        idempotency_key=debit_key,
    )
    if not spend.get("ok"):
        return {
            "ok": False,
            "error": spend.get("error"),
            "required": spend.get("required"),
            "balance": spend.get("balance"),
        }

    u = supabase.table("users").select("streak_shield_charges").eq("id", user_id).execute()
    charges = int(u.data[0].get("streak_shield_charges") or 0) if u.data else 0
    next_charges = charges + 1

    try:
        supabase.table("users").update({"streak_shield_charges": next_charges}).eq("id", user_id).execute()
    except Exception as e:
        logger.error(f"streak shield 컬럼 없음 또는 업데이트 실패 환급 user={user_id}: {e}")
        try:
            grant_tokens_with_ledger(
                supabase,
                user_id,
                delta=cost,
                reason="consumable_refund_streak_column",
                ref_type="consumable",
                ref_id=slug,
                idempotency_key=debit_key + ":refund",
            )
        except Exception as e2:
            logger.exception(e2)
        return {"ok": False, "error": "shield_update_failed", "message": str(e)}

    return {"ok": True, "balance": spend.get("balance"), "spent": cost, "charges": next_charges}


def _purchase_rakeback(
    supabase: Client,
    user_id: str,
    slug: str,
    survey_date: str,
    cost: int,
    *,
    idempotency_key: str,
) -> dict[str, Any]:
    meta = CONSUMABLE_PRODUCTS[slug]
    pct = int(meta["rakeback_pct"])
    flow_key = f"{idempotency_key}:rakeback:{slug}:{survey_date}"
    debit_key = flow_key + ":debit"
    grant_key = flow_key + ":credit"

    if ledger_exists_by_idempotency(supabase, user_id, grant_key):
        u = supabase.table("users").select("tokens").eq("id", user_id).execute()
        return {"ok": True, "already_done": True, "balance": int(u.data[0].get("tokens") or 100) if u.data else 100}

    ds = supabase.table("daily_surveys").select("is_closed, kospi_result").eq("survey_date", survey_date).execute()
    if not ds.data:
        return {"ok": False, "error": "bad_date", "message": "해당 날짜의 설문이 없습니다."}
    if not ds.data[0]["is_closed"] or ds.data[0].get("kospi_result") is None:
        return {"ok": False, "error": "not_settled", "message": "아직 결과가 확정·정산되지 않은 거래일입니다."}

    rr = (
        supabase.table("survey_responses")
        .select("tokens_won")
        .eq("user_id", user_id)
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not rr.data:
        return {"ok": False, "error": "no_response", "message": "그 날 참여 기록이 없습니다."}
    tokens_won = rr.data[0].get("tokens_won")
    if tokens_won is None:
        return {"ok": False, "error": "not_settled_row", "message": "토큰 정산 기록이 아직 없습니다."}
    if int(tokens_won) >= 0:
        return {"ok": False, "error": "no_loss", "message": "배팅 손실 기록이 없으면 레이크백을 받을 수 없습니다."}

    loss = abs(int(tokens_won))
    rebate = int(loss * pct / 100)
    if rebate <= 0:
        return {"ok": False, "error": "rebate_zero", "message": "환급액이 0이라 적용되지 않습니다."}

    spend = spend_tokens_idempotent(
        supabase,
        user_id,
        amount=cost,
        reason="consumable_purchase_rakeback",
        ref_type="consumable",
        ref_id=f"{slug}:{survey_date}",
        idempotency_key=debit_key,
    )
    if not spend.get("ok"):
        return {
            "ok": False,
            "error": spend.get("error"),
            "required": spend.get("required"),
            "balance": spend.get("balance"),
        }

    bal_after_buy = int(spend.get("balance") or 0)

    try:
        new_bal = grant_tokens_with_ledger(
            supabase,
            user_id,
            delta=rebate,
            reason="rakeback_reward",
            ref_type="consumable",
            ref_id=f"{slug}:{survey_date}",
            idempotency_key=grant_key,
        )
        return {
            "ok": True,
            "balance_after": new_bal,
            "balance_before_rakeback": bal_after_buy,
            "spent": cost,
            "rebate": rebate,
            "survey_date": survey_date,
        }
    except Exception as e:
        logger.exception("rakeback grant 실패 — 구매 차감 복구")
        try:
            grant_tokens_with_ledger(
                supabase,
                user_id,
                delta=cost,
                reason="rakeback_grant_fail_refund_buy",
                ref_type="consumable",
                ref_id=slug,
                idempotency_key=grant_key + ":refund_buy",
            )
        except Exception as e2:
            logger.error(f"rakeback 차감 복구 실패 수동 처리: {e2}")
        return {"ok": False, "error": "rakeback_grant_failed", "message": str(e)}
