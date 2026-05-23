# -*- coding: utf-8 -*-
"""표시용 참여 규모 보정 — 실제 유입이 적어도 공간이 북적이게 보이도록(거래일·날짜별 고정 시드)."""
from __future__ import annotations

import hashlib
import random
from typing import TypedDict


class CrowdDisplay(TypedDict):
    real_total: int
    total_responses: int
    rise_count: int
    fall_count: int
    kospi_yes_pct: int
    kospi_no_pct: int


# 실제 인원이 이 값 미만이면 표시용 인원을 키움
CROWD_PAD_THRESHOLD = 55
# 응답 0명일 때(장 초·사전 예측 직후) 보여 줄 최소·최대 규모
EMPTY_DISPLAY_MIN = 62
EMPTY_DISPLAY_MAX = 94
# 실제 응답이 있을 때 목표 표시 규모
BUSY_DISPLAY_MIN = 78
BUSY_DISPLAY_MAX = 128


def _rng_for_date(survey_date: str) -> random.Random:
    digest = hashlib.md5(survey_date.encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    return random.Random(seed)


def apply_crowd_display_padding(
    survey_date: str,
    real_total: int,
    real_up: int,
) -> CrowdDisplay:
    """
    실제 참여 수·상승 표를 거래일 기준 결정적 시드로 보정해 반환.
    같은 날짜면 새로고침해도 숫자가 크게 튀지 않음.
    """
    real_down = max(0, real_total - real_up)
    rng = _rng_for_date(survey_date)

    if real_total <= 0:
        display_total = rng.randint(EMPTY_DISPLAY_MIN, EMPTY_DISPLAY_MAX)
        up_ratio = rng.uniform(0.48, 0.58)
        display_up = max(1, min(display_total - 1, round(display_total * up_ratio)))
        display_down = display_total - display_up
    elif real_total >= CROWD_PAD_THRESHOLD:
        display_total = real_total
        display_up = real_up
        display_down = real_down
    else:
        target = rng.randint(
            max(BUSY_DISPLAY_MIN, real_total + 42),
            max(BUSY_DISPLAY_MAX, real_total + 72),
        )
        pad_total = target - real_total
        majority_up = real_up >= real_down
        if majority_up:
            pad_up_ratio = rng.uniform(0.52, 0.64)
        else:
            pad_up_ratio = rng.uniform(0.36, 0.48)
        pad_up = round(pad_total * pad_up_ratio)
        pad_down = pad_total - pad_up
        display_total = real_total + pad_total
        display_up = real_up + pad_up
        display_down = real_down + pad_down

    if display_total <= 0:
        display_total = 1
        display_up = 1
        display_down = 0

    yes_pct = round(display_up / display_total * 100)
    yes_pct = max(1, min(99, yes_pct))
    no_pct = 100 - yes_pct
    return {
        "real_total": real_total,
        "total_responses": display_total,
        "rise_count": display_up,
        "fall_count": display_down,
        "kospi_yes_pct": yes_pct,
        "kospi_no_pct": no_pct,
    }
