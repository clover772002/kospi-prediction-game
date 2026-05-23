# -*- coding: utf-8 -*-
"""공포·탐욕 지수 외부 소스 수집 (공개 API 우선)."""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_FETCH_TIMEOUT = 15.0

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


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


async def _get_json(url: str, *, timeout: float = _FETCH_TIMEOUT, headers: dict | None = None) -> Any:
    h = {**_BROWSER_HEADERS, **(headers or {})}
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=h)
        resp.raise_for_status()
        return resp.json()


async def _fetch_kospi_fgc() -> list[FgiReading]:
    try:
        data = await _get_json("https://kospi.feargreedchart.com/api/?action=kospi")
        score = data.get("score")
        return [
            FgiReading(
                market="🇰🇷 코스피",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://kospi.feargreedchart.com/",
                note=str(data.get("updated") or ""),
            )
        ]
    except Exception as e:
        logger.warning("KOSPI FGC fetch 실패: %s", e)
        return [
            FgiReading(
                "🇰🇷 코스피",
                "FearGreedChart",
                None,
                "—",
                "https://kospi.feargreedchart.com/",
                "조회 실패",
            )
        ]


async def _fetch_kospifgi() -> list[FgiReading]:
    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, headers=_BROWSER_HEADERS) as client:
            resp = await client.get("https://www.kospifgi.com/")
            resp.raise_for_status()
            page = resp.text
        m = re.search(
            r"Fear\s*(?:&amp;|&)\s*Greed Index\s*</[^>]+>\s*<h1>\s*([\d.]+)\s*</h1>",
            page,
            re.I | re.S,
        )
        if not m:
            m = re.search(r"<h1>\s*([\d]{1,2}\.[\d])\s*</h1>", page)
        if m:
            score = round(float(m.group(1)), 1)
            return [
                FgiReading(
                    market="🇰🇷 코스피",
                    source="KOSPI FGI",
                    score=score,
                    zone=zone_label(score, style="kospifgi"),
                    url="https://www.kospifgi.com/",
                )
            ]
    except Exception as e:
        logger.warning("KOSPI FGI(kospifgi.com) scrape 실패: %s", e)
    return []


async def _fetch_us_fgc() -> list[FgiReading]:
    try:
        data = await _get_json("https://feargreedchart.com/api/?action=all")
        score = (data.get("score") or {}).get("score")
        return [
            FgiReading(
                market="🇺🇸 미국",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://feargreedchart.com/",
            )
        ]
    except Exception as e:
        logger.warning("US FGC fetch 실패: %s", e)
        return [
            FgiReading(
                "🇺🇸 미국",
                "FearGreedChart",
                None,
                "—",
                "https://feargreedchart.com/",
                "조회 실패",
            )
        ]


async def _fetch_us_cnn() -> list[FgiReading]:
    try:
        data = await _get_json("https://production.dataviz.cnn.io/index/fearandgreed/graphdata")
        raw = (data.get("fear_and_greed") or {}).get("score")
        score = round(float(raw), 1) if raw is not None else None
        return [
            FgiReading(
                market="🇺🇸 미국",
                source="CNN",
                score=score,
                zone=zone_label(score),
                url="https://www.cnn.com/markets/fear-and-greed",
            )
        ]
    except Exception as e:
        logger.warning("CNN FGI fetch 실패: %s", e)
        return [
            FgiReading(
                market="🇺🇸 미국",
                source="CNN",
                score=None,
                zone="—",
                url="https://www.cnn.com/markets/fear-and-greed",
                note="조회 실패",
            )
        ]


async def _fetch_nikkei_fgc() -> list[FgiReading]:
    try:
        data = await _get_json("https://nikkei.feargreedchart.com/api/?action=nikkei")
        score = data.get("score")
        return [
            FgiReading(
                market="🇯🇵 니케이",
                source="FearGreedChart",
                score=score,
                zone=zone_label(score),
                url="https://nikkei.feargreedchart.com/",
                note=str(data.get("updated") or ""),
            )
        ]
    except Exception as e:
        logger.warning("Nikkei FGC fetch 실패: %s", e)
        return [
            FgiReading(
                "🇯🇵 니케이",
                "FearGreedChart",
                None,
                "—",
                "https://nikkei.feargreedchart.com/",
                "조회 실패",
            )
        ]


async def _fetch_crypto_fgi() -> list[FgiReading]:
    try:
        data = await _get_json("https://api.alternative.me/fng/?limit=1")
        row = (data.get("data") or [{}])[0]
        score = int(row["value"]) if row.get("value") is not None else None
        return [
            FgiReading(
                market="🪙 코인",
                source="Alternative.me",
                score=score,
                zone=zone_label(score),
                url="https://alternative.me/crypto/fear-and-greed-index/",
            )
        ]
    except Exception as e:
        logger.warning("Crypto FGI fetch 실패: %s", e)
        return [
            FgiReading(
                market="🪙 코인",
                source="Alternative.me",
                score=None,
                zone="—",
                url="https://alternative.me/crypto/fear-and-greed-index/",
                note="조회 실패",
            )
        ]


async def fetch_all_fgi_readings() -> list[FgiReading]:
    """소스별 병렬 수집 — 웹훅 타임아웃 완화."""
    chunks = await asyncio.gather(
        _fetch_kospi_fgc(),
        _fetch_kospifgi(),
        _fetch_us_fgc(),
        _fetch_us_cnn(),
        _fetch_nikkei_fgc(),
        _fetch_crypto_fgi(),
    )
    readings: list[FgiReading] = []
    for part in chunks:
        readings.extend(part)
    return readings
