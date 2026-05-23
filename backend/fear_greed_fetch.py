# -*- coding: utf-8 -*-
"""공포·탐욕 지수 외부 소스 수집 (공개 API 우선)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# (표시명, 점수, 구간, URL) — 텔레그램 HTML 링크용
@dataclass
class FgiReading:
    market: str
    source: str
    score: float | int | None
    zone: str
    url: str
    note: str = ""


def zone_label(score: float | int | None, *, style: str = "fgc") -> str:
    if score is None:
        return "—"
    s = float(score)
    if style == "kospifgi":
        if s <= 24:
            return "극단적 공포"
        if s <= 44:
            return "공포"
        if s <= 55:
            return "중립"
        if s <= 75:
            return "탐욕"
        return "극단적 탐욕"
    if s <= 20:
        return "극단적 공포"
    if s <= 40:
        return "공포"
    if s <= 60:
        return "중립"
    if s <= 80:
        return "탐욕"
    return "극단적 탐욕"


async def _get_json(url: str, *, timeout: float = 20.0, headers: dict | None = None) -> Any:
    h = {**_BROWSER_HEADERS, **(headers or {})}
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=h)
        resp.raise_for_status()
        return resp.json()


async def fetch_all_fgi_readings() -> list[FgiReading]:
    readings: list[FgiReading] = []

    try:
        data = await _get_json("https://kospi.feargreedchart.com/api/?action=kospi")
        score = data.get("score")
        readings.append(
            FgiReading(
                market="🇰🇷 코스피",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://kospi.feargreedchart.com/",
                note=str(data.get("updated") or ""),
            )
        )
    except Exception as e:
        logger.warning("KOSPI FGC fetch 실패: %s", e)
        readings.append(
            FgiReading("🇰🇷 코스피", "FearGreedChart", None, "—", "https://kospi.feargreedchart.com/", "조회 실패")
        )

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_BROWSER_HEADERS) as client:
            resp = await client.get("https://www.kospifgi.com/")
            resp.raise_for_status()
            html = resp.text
        import re

        m = re.search(
            r"Fear\s*(?:&amp;|&)\s*Greed Index\s*</[^>]+>\s*<h1>\s*([\d.]+)\s*</h1>",
            html,
            re.I | re.S,
        )
        if not m:
            m = re.search(r"<h1>\s*([\d]{1,2}\.[\d])\s*</h1>", html)
        if m:
            score = round(float(m.group(1)), 1)
            readings.append(
                FgiReading(
                    market="🇰🇷 코스피",
                    source="KOSPI FGI",
                    score=score,
                    zone=zone_label(score, style="kospifgi"),
                    url="https://www.kospifgi.com/",
                )
            )
    except Exception as e:
        logger.warning("KOSPI FGI(kospifgi.com) scrape 실패: %s", e)

    try:
        data = await _get_json("https://feargreedchart.com/api/?action=all")
        score = (data.get("score") or {}).get("score")
        readings.append(
            FgiReading(
                market="🇺🇸 미국",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://feargreedchart.com/",
            )
        )
    except Exception as e:
        logger.warning("US FGC fetch 실패: %s", e)
        readings.append(
            FgiReading("🇺🇸 미국", "FearGreedChart", None, "—", "https://feargreedchart.com/", "조회 실패")
        )

    try:
        data = await _get_json("https://production.dataviz.cnn.io/index/fearandgreed/graphdata")
        raw = (data.get("fear_and_greed") or {}).get("score")
        score = round(float(raw), 1) if raw is not None else None
        readings.append(
            FgiReading(
                market="🇺🇸 미국",
                source="CNN",
                score=score,
                zone=zone_label(score),
                url="https://www.cnn.com/markets/fear-and-greed",
            )
        )
    except Exception as e:
        logger.warning("CNN FGI fetch 실패: %s", e)
        readings.append(
            FgiReading(
                market="🇺🇸 미국",
                source="CNN",
                score=None,
                zone="—",
                url="https://www.cnn.com/markets/fear-and-greed",
                note="조회 실패",
            )
        )

    try:
        data = await _get_json("https://nikkei.feargreedchart.com/api/?action=nikkei")
        score = data.get("score")
        readings.append(
            FgiReading(
                market="🇯🇵 니케이",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://nikkei.feargreedchart.com/",
                note=str(data.get("updated") or ""),
            )
        )
    except Exception as e:
        logger.warning("Nikkei FGC fetch 실패: %s", e)
        readings.append(
            FgiReading("🇯🇵 니케이", "FearGreedChart", None, "—", "https://nikkei.feargreedchart.com/", "조회 실패")
        )

    try:
        data = await _get_json("https://api.alternative.me/fng/?limit=1")
        row = (data.get("data") or [{}])[0]
        score = int(row["value"]) if row.get("value") is not None else None
        readings.append(
            FgiReading(
                market="🪙 코인",
                source="Alternative.me",
                score=score,
                zone=zone_label(score),
                url="https://alternative.me/crypto/fear-and-greed-index/",
            )
        )
    except Exception as e:
        logger.warning("Crypto FGI fetch 실패: %s", e)
        readings.append(
            FgiReading(
                market="🪙 코인",
                source="Alternative.me",
                score=None,
                zone="—",
                url="https://alternative.me/crypto/fear-and-greed-index/",
                note="조회 실패",
            )
        )

    return readings
