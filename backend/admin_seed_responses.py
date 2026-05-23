# -*- coding: utf-8 -*-
"""관리자용: 봇 유저 + 랜덤 게이지(확신도) 설문 응답 시드."""
from __future__ import annotations

import logging
import random
import uuid
from typing import Any

from fastapi import HTTPException
from supabase import Client

logger = logging.getLogger(__name__)

SEED_EMAIL_DOMAIN = "bots.kospi-seed.local"
DEFAULT_BOT_TOKENS = 100


def _random_gauge(rng: random.Random, up_ratio: float | None) -> int:
    """-100~100, 0 제외."""
    if up_ratio is None:
        up = rng.random() < 0.5
    else:
        up = rng.random() < max(0.05, min(0.95, up_ratio))
    mag = rng.randint(5, 95)
    return mag if up else -mag


def _ensure_survey_open(supabase: Client, survey_date: str, *, force: bool) -> None:
    res = (
        supabase.table("daily_surveys")
        .select("survey_date, is_closed")
        .eq("survey_date", survey_date)
        .limit(1)
        .execute()
    )
    if not res.data:
        supabase.table("daily_surveys").insert(
            {"survey_date": survey_date, "is_closed": False}
        ).execute()
        return
    if res.data[0].get("is_closed") and not force:
        raise HTTPException(
            status_code=400,
            detail="설문이 마감됐습니다. force=true 로 무시하고 넣을 수 있습니다.",
        )


def seed_survey_responses(
    supabase: Client,
    survey_date: str,
    count: int,
    *,
    up_ratio: float | None = None,
    dry_run: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    """
    봇 계정을 만들고 survey_responses에 랜덤 gauge_position을 INSERT.
    실제 집계·/api/today·소통방 인원에 반영됩니다(표시 패딩 아님).
    """
    if count < 1 or count > 200:
        raise HTTPException(status_code=422, detail="count는 1~200")

    _ensure_survey_open(supabase, survey_date, force=force)

    rng = random.Random(f"{survey_date}:{count}:{up_ratio}")
    created: list[dict[str, Any]] = []
    errors: list[str] = []

    for _ in range(count):
        gauge = _random_gauge(rng, up_ratio)
        email = f"seed+{survey_date}+{uuid.uuid4().hex[:10]}@{SEED_EMAIL_DOMAIN}"
        name = f"참여{rng.randint(1000, 9999)}"
        preview = {
            "email": email,
            "name": name,
            "gauge_position": gauge,
            "kospi_answer": gauge > 0,
        }
        if dry_run:
            created.append(preview)
            continue

        try:
            auth_res = supabase.auth.admin.create_user(
                {
                    "email": email,
                    "password": uuid.uuid4().hex,
                    "email_confirm": True,
                    "user_metadata": {"name": name, "is_seed_bot": True},
                }
            )
            user_id = str(auth_res.user.id)
        except Exception as e:
            msg = f"auth 생성 실패 ({email}): {e}"
            logger.warning(msg)
            errors.append(msg)
            continue

        try:
            supabase.table("users").upsert(
                {"id": user_id, "email": email, "name": name},
                on_conflict="id",
            ).execute()
        except Exception as e:
            logger.warning("users upsert 실패 %s: %s", user_id, e)

        tokens_bet = max(1, round(abs(gauge) / 100 * DEFAULT_BOT_TOKENS))
        try:
            supabase.table("survey_responses").insert(
                {
                    "user_id": user_id,
                    "survey_date": survey_date,
                    "kospi_answer": gauge > 0,
                    "kosdaq_answer": False,
                    "gauge_position": gauge,
                    "tokens_bet": tokens_bet,
                    "tokens_before": DEFAULT_BOT_TOKENS,
                }
            ).execute()
            created.append({**preview, "user_id": user_id})
        except Exception as e:
            msg = f"응답 저장 실패 ({user_id}): {e}"
            logger.warning(msg)
            errors.append(msg)
            try:
                supabase.auth.admin.delete_user(user_id)
            except Exception:
                pass

    after = (
        supabase.table("survey_responses")
        .select("user_id", count="exact", head=True)
        .eq("survey_date", survey_date)
        .execute()
    )
    total_after = int(getattr(after, "count", None) or 0)

    return {
        "survey_date": survey_date,
        "dry_run": dry_run,
        "requested": count,
        "created": len(created),
        "total_responses_after": total_after,
        "samples": created[:5],
        "errors": errors[:8],
    }


def clear_seed_responses(supabase: Client, survey_date: str) -> dict[str, Any]:
    """해당 거래일 시드 봇 응답·계정 제거."""
    users = (
        supabase.table("users")
        .select("id, email")
        .ilike("email", f"seed+{survey_date}@%")
        .execute()
    )
    ids = [str(r["id"]) for r in (users.data or [])]
    removed_resp = 0
    for uid in ids:
        try:
            del_res = (
                supabase.table("survey_responses")
                .delete()
                .eq("user_id", uid)
                .eq("survey_date", survey_date)
                .execute()
            )
            removed_resp += len(del_res.data or [])
        except Exception as e:
            logger.warning("응답 삭제 실패 %s: %s", uid, e)
        try:
            supabase.auth.admin.delete_user(uid)
        except Exception as e:
            logger.warning("auth 삭제 실패 %s: %s", uid, e)
        try:
            supabase.table("users").delete().eq("id", uid).execute()
        except Exception:
            pass

    return {
        "survey_date": survey_date,
        "seed_users_found": len(ids),
        "responses_cleared": removed_resp,
    }
