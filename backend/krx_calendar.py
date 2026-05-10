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


def last_trading_day_on_or_before(d: date) -> date:
    """d가 속한 역방향 탐색: 첫 KRX 근거 거래일까지 일수를 깎으며 찾음."""
    cur = d
    for _ in range(400):
        if is_krx_trading_day(cur):
            return cur
        cur -= timedelta(days=1)
    raise ValueError("400일 이내 거래일을 찾지 못했습니다.")


def previous_trading_day_before(d: date) -> date:
    """정확히 d보다 이전의 가장 가까운 거래일."""
    cur = d - timedelta(days=1)
    for _ in range(400):
        if is_krx_trading_day(cur):
            return cur
        cur -= timedelta(days=1)
    raise ValueError("이전 거래일을 찾지 못했습니다.")


def last_n_trading_days_inclusive_through(end_calendar: date, n: int) -> list[date]:
    """
    end_calendar를 포함하여 거래일 n개 구간을 **과거→현재 순(오름차순)**으로 반환.
    end가 비거래일이면 직전 거래일까지 당김해서 그 일을 종료 거래일로 둠.
    """
    if n < 1:
        raise ValueError("n은 1 이상이어야 합니다.")
    anchor = last_trading_day_on_or_before(end_calendar)
    newest_first: list[date] = []
    cur = anchor
    for _ in range(n):
        newest_first.append(cur)
        cur = previous_trading_day_before(cur)
    return list(reversed(newest_first))


def today_date_kst() -> date:
    """한국 시간 기준 오늘 날짜."""
    return datetime.now(KST).date()
