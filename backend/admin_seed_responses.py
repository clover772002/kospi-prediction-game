# -*- coding: utf-8 -*-
"""관리자용: 봇 유저 + 랜덤 게이지(확신도) 설문 응답 시드."""
from __future__ import annotations

import logging
import random
import uuid
from typing import Any

from fastapi import HTTPException
from supabase import Client

from blind_poll_parse import parse_blind_poll_text

logger = logging.getLogger(__name__)

SEED_EMAIL_DOMAIN = "bots.kospi-seed.local"
DEFAULT_BOT_TOKENS = 100
MAX_SEED_PER_CALL = 200


def _random_gauge_for_side(rng: random.Random, *, up: bool) -> int:
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


def _scale_poll_counts(
    total_votes: int,
    up_votes: int,
    *,
    max_seed: int,
) -> tuple[int, int, int]:
    """블라인드 표본이 크면 max_seed까지 비율 유지하며 축소."""
    if total_votes <= max_seed:
        return total_votes, up_votes, total_votes - up_votes
    ratio = up_votes / total_votes if total_votes else 0.5
    scaled_total = max_seed
    scaled_up = max(1, min(scaled_total - 1, round(scaled_total * ratio)))
    scaled_down = scaled_total - scaled_up
    return scaled_total, scaled_up, scaled_down


def _build_gauge_list(rng: random.Random, up_votes: int, down_votes: int) -> list[int]:
    gauges = [_random_gauge_for_side(rng, up=True) for _ in range(up_votes)]
    gauges.extend(_random_gauge_for_side(rng, up=False) for _ in range(down_votes))
    rng.shuffle(gauges)
    return gauges


def _insert_one_seed_response(
    supabase: Client,
    survey_date: str,
    gauge: int,
    rng: random.Random,
    *,
    dry_run: bool,
) -> dict[str, Any] | None:
    email = f"seed+{survey_date}+{uuid.uuid4().hex[:10]}@{SEED_EMAIL_DOMAIN}"
    name = f"참여{rng.randint(1000, 9999)}"
    preview = {
        "email": email,
        "name": name,
        "gauge_position": gauge,
        "kospi_answer": gauge > 0,
    }
    if dry_run:
        return preview

    try:
        auth_res = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": uuid.uuid4().hex,
                "email_confirm": True,
                "user_metadata": {"name": name, "is_seed_bot": True, "source": "blind_poll"},
            }
        )
        user_id = str(auth_res.user.id)
    except Exception as e:
        logger.warning("auth 생성 실패: %s", e)
        return None

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
        return {**preview, "user_id": user_id}
    except Exception as e:
        logger.warning("응답 저장 실패 %s: %s", user_id, e)
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception:
            pass
        return None


def seed_survey_from_poll(
    supabase: Client,
    survey_date: str,
    *,
    total_votes: int,
    up_votes: int,
    down_votes: int | None = None,
    up_pct: float | None = None,
    max_seed: int = MAX_SEED_PER_CALL,
    dry_run: bool = False,
    force: bool = False,
    source: str = "manual",
) -> dict[str, Any]:
    """블라인드(또는 수동) 투표 비율에 맞춰 확신도만 랜덤인 응답 N건 생성."""
    if down_votes is None:
        down_votes = total_votes - up_votes
    if up_votes + down_votes != total_votes:
        raise HTTPException(status_code=422, detail="up_votes + down_votes != total_votes")

    scaled_total, scaled_up, scaled_down = _scale_poll_counts(
        total_votes, up_votes, max_seed=max(1, min(max_seed, MAX_SEED_PER_CALL))
    )
    _ensure_survey_open(supabase, survey_date, force=force)

    rng = random.Random(f"{survey_date}:poll:{scaled_up}:{scaled_total}:{source}")
    gauges = _build_gauge_list(rng, scaled_up, scaled_down)

    created: list[dict[str, Any]] = []
    errors = 0
    for gauge in gauges:
        row = _insert_one_seed_response(
            supabase, survey_date, gauge, rng, dry_run=dry_run
        )
        if row:
            created.append(row)
        else:
            errors += 1

    after = (
        supabase.table("survey_responses")
        .select("user_id", count="exact", head=True)
        .eq("survey_date", survey_date)
        .execute()
    )

    return {
        "survey_date": survey_date,
        "source": source,
        "dry_run": dry_run,
        "blind_poll": {
            "total_votes": total_votes,
            "up_votes": up_votes,
            "down_votes": down_votes,
            "up_pct": up_pct,
        },
        "seeded": {
            "total": scaled_total,
            "up": scaled_up,
            "down": scaled_down,
            "scaled_from_blind": total_votes > scaled_total,
        },
        "created": len(created),
        "failed": errors,
        "total_responses_after": int(getattr(after, "count", None) or 0),
        "samples": created[:5],
    }


def seed_survey_from_blind_text(
    supabase: Client,
    survey_date: str,
    poll_text: str,
    *,
    max_seed: int = MAX_SEED_PER_CALL,
    dry_run: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    parsed = parse_blind_poll_text(poll_text)
    out = seed_survey_from_poll(
        supabase,
        survey_date,
        total_votes=parsed["total_votes"],
        up_votes=parsed["up_votes"],
        down_votes=parsed["down_votes"],
        up_pct=parsed["up_pct"],
        max_seed=max_seed,
        dry_run=dry_run,
        force=force,
        source="blind_paste",
    )
    out["parsed"] = parsed
    return out


def seed_survey_responses(
    supabase: Client,
    survey_date: str,
    count: int,
    *,
    up_ratio: float | None = None,
    dry_run: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    """완전 랜덤 비율 시드 (블라인드 없이)."""
    if count < 1 or count > MAX_SEED_PER_CALL:
        raise HTTPException(status_code=422, detail=f"count는 1~{MAX_SEED_PER_CALL}")

    ratio = 0.5 if up_ratio is None else max(0.05, min(0.95, up_ratio))
    up_votes = round(count * ratio)
    if up_votes < 1:
        up_votes = 1
    if up_votes >= count:
        up_votes = count - 1
    return seed_survey_from_poll(
        supabase,
        survey_date,
        total_votes=count,
        up_votes=up_votes,
        up_pct=round(up_votes / count * 100, 2),
        max_seed=count,
        dry_run=dry_run,
        force=force,
        source="random",
    )


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
