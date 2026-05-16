# -*- coding: utf-8 -*-
"""당일 거래일(survey_date) 기준 코스피 참가자 리더보드 — /api/today detail participants와 동일 정렬 규칙."""
from __future__ import annotations

from supabase import Client

from accuracy_aggregate import get_accuracy_data


def build_kospi_leaderboard_for_survey_date(supabase: Client, survey_date: str) -> list[dict]:
    """
    survey_responses 해당 날짜 응답자만 포함.
    정렬: 적중률 내림차순(null은 -1 처리와 동등한 효과로 뒤로), 동률 시 total_predictions 많은 순.
    반환 각 항목: user_id, masked_name, kospi_answer, accuracy, total_predictions, rank (1-base)
    """
    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", survey_date)
        .execute()
    )
    rows = responses.data or []
    if not rows:
        return []

    acc_map, pred_count, _ = get_accuracy_data(supabase)
    all_uids = [str(r["user_id"]) for r in rows]

    try:
        name_rows = supabase.table("users").select("id, name").in_("id", all_uids).execute()
        name_map = {str(row["id"]): row.get("name") or "" for row in (name_rows.data or [])}
    except Exception:
        name_map = {}

    resp_map = {str(r["user_id"]): r for r in rows}

    def _masked(uid: str) -> str:
        name = name_map.get(uid, "")
        return (name[0] + "**") if name else "익명"

    out: list[dict] = []
    for uid in all_uids:
        r = resp_map[uid]
        av = acc_map.get(uid)
        out.append({
            "user_id": uid,
            "masked_name": _masked(uid),
            "kospi_answer": r["kospi_answer"],
            "accuracy": round(av * 100) if av is not None else None,
            "total_predictions": pred_count.get(uid, 0),
        })

    out.sort(key=lambda x: (-(x["accuracy"] if x["accuracy"] is not None else -1), -x["total_predictions"]))
    for i, row in enumerate(out):
        row["rank"] = i + 1
    return out


def ranked_user_ids(entries: list[dict], *, top_n: int) -> list[str]:
    return [str(e["user_id"]) for e in entries[: max(0, top_n)]]
