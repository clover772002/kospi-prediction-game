# -*- coding: utf-8 -*-
"""코스피 근거 간이 거래일·공휴일 판별 (notifications·next survey date).

실제 증권 거래소 휴장과 완전 일치하지 않을 수 있습니다. 패키지 `holidays`의
대한민국 법정공휴일 + 주말을 거래 불가일로 두는 모델입니다.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import holidays

KST = ZoneInfo("Asia/Seoul")

# 법정공휴일·대체 휴무일 등(holidays 라이브러리가 연도별로 유지보수)
_KR_PUBLIC = holidays.SouthKorea()


def korea_public_holiday_on(d: date) -> bool:
    """그 날짜가 대한민국 법정공휴일(패키지 기준)이면 참."""
    return d in _KR_PUBLIC


def is_krx_trading_day(d: date) -> bool:
    """주중이며 법정공휴일이 아닌 날 = 설문 대상 장 개장일 모델."""
    if d.weekday() >= 5:
        return False
    return not korea_public_holiday_on(d)


def next_trading_day_str(*, now_kst: datetime | None = None) -> str:
    """현재 시각 기준 내일부터 찾아 첫 KRX 근거 거래일 날짜 문자열 YYYY-MM-DD."""
    anchor = now_kst or datetime.now(KST)
    return next_trading_day_from(anchor.date()).isoformat()


def next_trading_day_from(d: date) -> date:
    """d의 다음 날부터 첫 거래일 (주말·법정 공휴일 제외)."""
    cur = d + timedelta(days=1)
    while not is_krx_trading_day(cur):
        cur += timedelta(days=1)
    return cur


def today_date_kst() -> date:
    """한국 시간 기준 오늘 날짜."""
    return datetime.now(KST).date()
