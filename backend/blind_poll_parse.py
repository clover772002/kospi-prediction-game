# -*- coding: utf-8 -*-
"""블라인드(TeamBlind) 설문 글에서 복사한 텍스트 → 상승·하락·참여 수 파싱."""
from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException


def _first_float(patterns: list[str], text: str) -> float | None:
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if m:
            return float(m.group(1))
    return None


def parse_blind_poll_text(raw: str) -> dict[str, Any]:
    """
    예시 입력(복사·붙여넣기):
      내일 코스피는?
      상승 62%  ·  하락 38%
      1,284명 참여

    또는:
      Up 55% / Down 45% · 892 votes
    """
    if not raw or not raw.strip():
        raise HTTPException(status_code=422, detail="poll_text가 비어 있습니다.")

    text = raw.replace(",", "").replace("，", "")

    up_pct = _first_float(
        [
            r"상승\s*(\d+(?:\.\d+)?)\s*%",
            r"오른(?:다|ㄴ다|름)\s*(\d+(?:\.\d+)?)\s*%",
            r"up\s*(\d+(?:\.\d+)?)\s*%",
            r"▲\s*(\d+(?:\.\d+)?)\s*%",
        ],
        text,
    )
    down_pct = _first_float(
        [
            r"하락\s*(\d+(?:\.\d+)?)\s*%",
            r"내린(?:다|ㄴ다|음)\s*(\d+(?:\.\d+)?)\s*%",
            r"down\s*(\d+(?:\.\d+)?)\s*%",
            r"▼\s*(\d+(?:\.\d+)?)\s*%",
        ],
        text,
    )

    if up_pct is None and down_pct is not None:
        up_pct = max(0.0, 100.0 - down_pct)
    elif down_pct is None and up_pct is not None:
        down_pct = max(0.0, 100.0 - up_pct)
    elif up_pct is None and down_pct is None:
        # "62 : 38" 형태
        m = re.search(r"(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)", text)
        if m:
            a, b = float(m.group(1)), float(m.group(2))
            if a + b > 0:
                up_pct = round(a / (a + b) * 100, 2)
                down_pct = round(100 - up_pct, 2)

    total_votes = None
    for pat in (
        r"(\d+)\s*(?:명|표|참여|투표|votes?|participants?)",
        r"(?:총|전체|total)\s*(\d+)",
        r"(\d+)\s*(?:명이|명의)",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            total_votes = int(m.group(1))
            break

    up_votes = down_votes = None
    for pat in (
        r"상승\s*(\d+)\s*(?:표|명|votes?)",
        r"하락\s*(\d+)\s*(?:표|명|votes?)",
    ):
        pass  # optional explicit counts — rare in UI copy

    m_up = re.search(r"상승[^\d]{0,20}(\d+)\s*(?:표|명)", text)
    m_dn = re.search(r"하락[^\d]{0,20}(\d+)\s*(?:표|명)", text)
    if m_up:
        up_votes = int(m_up.group(1))
    if m_dn:
        down_votes = int(m_dn.group(1))

    if up_votes is not None and down_votes is not None:
        total_votes = up_votes + down_votes
    elif total_votes and up_pct is not None:
        up_votes = round(total_votes * up_pct / 100)
        down_votes = total_votes - up_votes
    elif up_pct is not None and down_pct is not None and total_votes:
        up_votes = round(total_votes * up_pct / 100)
        down_votes = total_votes - up_votes

    if up_pct is None or total_votes is None or total_votes < 1:
        raise HTTPException(
            status_code=422,
            detail=(
                "상승·하락 %와 참여 인원(표)을 찾지 못했습니다. "
                "예: '상승 62% 하락 38% · 1,284명 참여' 형태로 붙여넣어 주세요."
            ),
        )

    if up_votes is None:
        up_votes = round(total_votes * up_pct / 100)
        down_votes = total_votes - up_votes

    return {
        "up_pct": round(up_pct, 2),
        "down_pct": round(down_pct or (100 - up_pct), 2),
        "total_votes": int(total_votes),
        "up_votes": int(up_votes),
        "down_votes": int(down_votes),
    }


def parse_admin_poll_simple(raw: str) -> dict[str, Any]:
    """
    관리자 DM용 — 상승 % · 참여 인원만.
    예: 62 1284  /  62% 1284명  /  상승 62 1284
    """
    if not raw or not raw.strip():
        raise HTTPException(status_code=422, detail="숫자 두 개(상승%, 참여 수)를 보내주세요.")

    text = raw.replace(",", "").replace("，", "").strip()

    up_pct = _first_float(
        [
            r"상승\s*(\d+(?:\.\d+)?)\s*%?",
            r"(\d+(?:\.\d+)?)\s*%",
        ],
        text,
    )

    total_votes: int | None = None
    m = re.search(
        r"(\d+)\s*(?:명|표|참여|인|votes?|participants?)",
        text,
        re.IGNORECASE,
    )
    if m:
        total_votes = int(m.group(1))

    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", text)]
    ints = [int(round(x)) for x in nums]

    if up_pct is None:
        for n in nums:
            if 0 < n <= 100:
                up_pct = n
                break

    if total_votes is None and ints:
        big = [n for n in ints if n > 100]
        if big:
            total_votes = max(big)
        elif len(ints) >= 2 and up_pct is not None:
            other = [n for n in ints if n != int(up_pct)]
            total_votes = max(other) if other else None
        elif len(ints) == 1 and up_pct is not None and ints[0] != int(up_pct):
            total_votes = ints[0]

    if up_pct is None or total_votes is None or total_votes < 1:
        raise HTTPException(
            status_code=422,
            detail="상승 %와 참여 인원을 알려주세요. 예: 62 1284 (한 줄) 또는 62% / 1284명",
        )

    up_pct = max(1.0, min(99.0, float(up_pct)))
    up_votes = round(total_votes * up_pct / 100)
    if up_votes < 1:
        up_votes = 1
    if up_votes >= total_votes:
        up_votes = total_votes - 1
    down_votes = total_votes - up_votes

    return {
        "up_pct": round(up_pct, 2),
        "down_pct": round(100 - up_pct, 2),
        "total_votes": int(total_votes),
        "up_votes": int(up_votes),
        "down_votes": int(down_votes),
    }
