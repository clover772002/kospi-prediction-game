# -*- coding: utf-8 -*-
"""설문 규칙 변경용 소모품(토큰 결제 후 grant·환급 등)."""

CONSUMABLE_PRODUCTS = {
    "vote_redo_once": {
        "title": "재투표 1회",
        "category": "item",
        "price_tokens": 50,
        "description": (
            "오늘의 설문(당일 거래일 픽)에 이미 응답한 뒤, 답을 한 번 더 바꿀 수 있는 권한입니다. "
            "다른 날짜를 지정할 수 없으며 구매 시 자동으로 오늘 설문에만 붙습니다. "
            "구매 후 설문 화면에서 다시 제출하면 소비됩니다. 매매·투자 조언이 아닙니다."
        ),
        "requires_survey_date": False,
    },
    "gauge_adjust_keep_direction_once": {
        "title": "게이지만 1회 조정 (방향 유지)",
        "category": "item",
        "price_tokens": 30,
        "description": (
            "09:00 마감 전에는 설문 화면에서 방향 유지·확신도 수정이 무료입니다. "
            "이 아이템은 마감 후 등 특수 상황용 예비 권한이며, 방향은 유지한 채 게이지만 한 번 조정합니다."
        ),
        "requires_survey_date": False,
    },
    "direction_flip_keep_magnitude_once": {
        "title": "방향만 반전 (확신 강도 유지)",
        "category": "item",
        "price_tokens": 30,
        "description": (
            "오늘의 설문(당일 픽)에 이미 제출한 답에 한해, 확신 강도(절댓값)는 두고 상승·하락만 한 번 바꿉니다. "
            "날짜 지정 불가이며 자동으로 당일 설문에만 적용됩니다."
        ),
        "requires_survey_date": False,
    },
    "streak_protect_next_miss": {
        "title": "연승 카운트 보호",
        "category": "item",
        "price_tokens": 90,
        "description": (
            "다음 한 번 결과가 오답이어도 연승(스트릭) 숫자는 리셋되지 않습니다. "
            "배팅·토큰 정산 결과 자체는 기존 게임 규칙과 동일합니다."
        ),
        "requires_survey_date": False,
    },
    "rakeback_daily_loss_pct10": {
        "title": "배팅 손실 환급 10%",
        "category": "item",
        "price_tokens": 40,
        "description": (
            "특정 거래일 결과 정산이 끝난 뒤 그날 기록된 배팅 손실액(tokens_won<0 의 절대값)의 10%를 토큰으로 돌려받습니다. "
            "(참여 보너스·연속 배당 등은 포함하지 않음.) 같은 날 같은 티어는 한 번만."
        ),
        "rakeback_pct": 10,
        "requires_survey_date": True,
    },
    "rakeback_daily_loss_pct20": {
        "title": "배팅 손실 환급 20%",
        "category": "item",
        "price_tokens": 70,
        "description": "배팅 손실액의 20% 환급. 조건 동일.",
        "rakeback_pct": 20,
        "requires_survey_date": True,
    },
    "rakeback_daily_loss_pct50": {
        "title": "배팅 손실 환급 50%",
        "category": "item",
        "price_tokens": 110,
        "description": "배팅 손실액의 50% 환급. 조건 동일.",
        "rakeback_pct": 50,
        "requires_survey_date": True,
    },
    "rakeback_daily_loss_pct100": {
        "title": "배팅 손실 환급 100%",
        "category": "item",
        "price_tokens": 220,
        "description": "배팅 손실액의 100% 환급에 가까움 (밸런스 테스트용 과금 가정). 같은 날 같은 티어만.",
        "rakeback_pct": 100,
        "requires_survey_date": True,
    },
}


def consumable_known(slug: str) -> bool:
    return slug in CONSUMABLE_PRODUCTS
