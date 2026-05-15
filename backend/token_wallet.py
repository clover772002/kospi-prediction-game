# -*- coding: utf-8 -*-
"""토큰 ledger / 아이템(집계 열람) 차감 (Supabase 서비스 롤 전용)."""
from __future__ import annotations

import logging
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)


def ledger_exists_by_idempotency(supabase: Client, user_id: str, idempotency_key: str) -> bool:
    try:
        r = (
            supabase.table("token_ledger")
            .select("id")
            .eq("user_id", user_id)
            .eq("idempotency_key", idempotency_key)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception as e:
        logger.warning(f"ledger idempotency check 실패(table 없음 가능): {e}")
        return False


def entitlement_exists(supabase: Client, user_id: str, product_slug: str, scope_key: str) -> bool:
    try:
        r = (
            supabase.table("insight_entitlements")
            .select("id")
            .eq("user_id", user_id)
            .eq("product_slug", product_slug)
            .eq("scope_key", scope_key)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception as e:
        # 테이블 미생성 등: GET 아이템 열람은 잠금 상태로 두고 카드 로드 실패(503)를 피함.
        logger.warning(
            "insight_entitlements 조회 실패 — 테이블이 없으면 Supabase SQL에 schema_shop_insights.sql 실행: %s",
            e,
        )
        return False


def insert_ledger(
    supabase: Client,
    user_id: str,
    *,
    delta: int,
    reason: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
    idempotency_key: str | None = None,
    balance_after: int | None = None,
) -> None:
    row: dict[str, Any] = {
        "user_id": user_id,
        "delta": delta,
        "reason": reason,
        "ref_type": ref_type,
        "ref_id": ref_id,
        "balance_after": balance_after,
        "idempotency_key": idempotency_key,
    }
    supabase.table("token_ledger").insert({k: v for k, v in row.items() if v is not None}).execute()


def insert_entitlement(
    supabase: Client,
    user_id: str,
    *,
    product_slug: str,
    scope_key: str,
    source: str,
    idempotency_key: str | None = None,
) -> None:
    supabase.table("insight_entitlements").insert(
        {
            "user_id": user_id,
            "product_slug": product_slug,
            "scope_key": scope_key,
            "source": source,
            "idempotency_key": idempotency_key,
        }
    ).execute()


def unlock_insight_with_tokens(
    supabase: Client,
    user_id: str,
    *,
    product_slug: str,
    scope_key: str,
    price_tokens: int,
    idempotency_key: str,
) -> dict[str, Any]:
    """멱등: 동일 idempotency_key 또는 기존 entitlement 시 잔액 차감 없음."""
    if entitlement_exists(supabase, user_id, product_slug, scope_key):
        u = supabase.table("users").select("tokens").eq("id", user_id).execute()
        bal = (u.data[0].get("tokens") if u.data else None) or 100
        return {"ok": True, "already_unlocked": True, "balance": bal}

    if ledger_exists_by_idempotency(supabase, user_id, idempotency_key):
        u = supabase.table("users").select("tokens").eq("id", user_id).execute()
        bal = (u.data[0].get("tokens") if u.data else None) or 100
        return {"ok": True, "already_unlocked": True, "balance": bal}

    urow = supabase.table("users").select("tokens").eq("id", user_id).execute()
    if not urow.data:
        raise PermissionError("user_not_found")
    balance_before = int(urow.data[0].get("tokens") or 100)
    if balance_before < price_tokens:
        return {
            "ok": False,
            "error": "insufficient_tokens",
            "required": price_tokens,
            "balance": balance_before,
        }

    balance_after = balance_before - price_tokens
    upd = (
        supabase.table("users")
        .update({"tokens": balance_after})
        .eq("id", user_id)
        .eq("tokens", balance_before)
        .execute()
    )
    if not upd.data:
        logger.warning(f"토큰 동시성 충돌 user={user_id} slug={product_slug}")
        raise RuntimeError("concurrent_token_update")

    try:
        insert_ledger(
            supabase,
            user_id,
            delta=-price_tokens,
            reason="insight_unlock",
            ref_type="insight_product",
            ref_id=product_slug + ":" + scope_key,
            idempotency_key=idempotency_key,
            balance_after=balance_after,
        )
        insert_entitlement(
            supabase,
            user_id,
            product_slug=product_slug,
            scope_key=scope_key,
            source="tokens",
            idempotency_key=idempotency_key,
        )
    except Exception as e:
        logger.error(f"unlock 후속 기록 실패 — 수동 확인 필요 user={user_id}: {e}")
        supabase.table("users").update({"tokens": balance_before}).eq("id", user_id).execute()
        raise

    return {"ok": True, "already_unlocked": False, "balance": balance_after, "spent": price_tokens}


def spend_tokens_idempotent(
    supabase: Client,
    user_id: str,
    *,
    amount: int,
    reason: str,
    ref_type: str | None,
    ref_id: str | None,
    idempotency_key: str,
) -> dict[str, Any]:
    """양수 차감(소모품 구매 등). 동일 멱등 키면 이미 처리된 것으로 보고 현재 잔액 반환."""
    if amount <= 0:
        raise ValueError("spend_tokens_idempotent: amount must be positive")

    try:
        if ledger_exists_by_idempotency(supabase, user_id, idempotency_key):
            u = supabase.table("users").select("tokens").eq("id", user_id).execute()
            bal = int(u.data[0].get("tokens") or 100) if u.data else 100
            return {"ok": True, "spent": False, "balance": bal}
    except Exception:
        pass

    urow = supabase.table("users").select("tokens").eq("id", user_id).execute()
    if not urow.data:
        raise PermissionError("user_not_found")
    balance_before = int(urow.data[0].get("tokens") or 100)
    if balance_before < amount:
        return {
            "ok": False,
            "spent": False,
            "error": "insufficient_tokens",
            "required": amount,
            "balance": balance_before,
        }
    balance_after = balance_before - amount
    upd = (
        supabase.table("users")
        .update({"tokens": balance_after})
        .eq("id", user_id)
        .eq("tokens", balance_before)
        .execute()
    )
    if not upd.data:
        logger.warning(f"토큰 동시성 충돌 spend user={user_id}")
        raise RuntimeError("concurrent_token_update")
    try:
        insert_ledger(
            supabase,
            user_id,
            delta=-amount,
            reason=reason,
            ref_type=ref_type,
            ref_id=ref_id,
            idempotency_key=idempotency_key,
            balance_after=balance_after,
        )
    except Exception as e:
        logger.error(f"spend ledger 실패 user={user_id}: {e}")
        supabase.table("users").update({"tokens": balance_before}).eq("id", user_id).execute()
        raise
    return {"ok": True, "spent": True, "balance": balance_after, "paid": amount}


def grant_tokens_with_ledger(
    supabase: Client,
    user_id: str,
    *,
    delta: int,
    reason: str,
    ref_type: str | None,
    ref_id: str | None,
    idempotency_key: str,
) -> int:
    """충전/보상 등 양수 delta. 동일 멱등 키면 스킵하고 현재 잔액 반환."""
    if delta <= 0:
        raise ValueError("grant_tokens expects positive delta")

    try:
        if ledger_exists_by_idempotency(supabase, user_id, idempotency_key):
            u = supabase.table("users").select("tokens").eq("id", user_id).execute()
            return int(u.data[0].get("tokens") or 100) if u.data else 100
    except Exception:
        pass

    urow = supabase.table("users").select("tokens").eq("id", user_id).execute()
    if not urow.data:
        raise PermissionError("user_not_found")
    balance_before = int(urow.data[0].get("tokens") or 100)
    balance_after = balance_before + delta
    supabase.table("users").update({"tokens": balance_after}).eq("id", user_id).execute()
    try:
        insert_ledger(
            supabase,
            user_id,
            delta=delta,
            reason=reason,
            ref_type=ref_type,
            ref_id=ref_id,
            idempotency_key=idempotency_key,
            balance_after=balance_after,
        )
    except Exception as e:
        logger.error(f"충전 ledger 실패 user={user_id}: {e}")
        supabase.table("users").update({"tokens": balance_before}).eq("id", user_id).execute()
        raise
    return balance_after
