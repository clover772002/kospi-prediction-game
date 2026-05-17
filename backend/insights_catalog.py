# -*- coding: utf-8 -*-
"""
단일 재화 플랜: 게임과 동일 users.tokens 로 아이템(집계 열람) 차감.
"""

INSIGHT_PRODUCTS = {
    "daily_expert_gap": {
        "title": "고수보정, 일반통계",
        "price_tokens": 120,
        "description": "한 장의 카드에서 누적 적중을 반영한 가중예측(고수보정)과 단순 다수결(일반통계)을 함께 봅니다. 해당 거래일에 설문 응답이 있어야 열립니다.",
    },
    "crowd_conviction_spread": {
        "title": "확신도 분포",
        "price_tokens": 60,
        "description": "그날 코스피 상승을 선택한 무리와 하락을 선택한 무리로 나누어, 각각의 게이지(확신도) 분포를 요약합니다. 개별 응답은 포함하지 않습니다.",
    },
    "rolling_crowd_summary": {
        "title": "고수의 7일간 적중률",
        "price_tokens": 140,
        "description": "선택한 날을 끝으로 최근 거래일 7일 구간에서, 지금까지 기준 최고 고수 1명이 그날 설문에 참여한 날의 코스피 방향 적중 여부(0%·100%)를 시계열로 봅니다. 미참여·미확정일은 비워 둘 수 있습니다.",
    },
    "time_slice_accuracy": {
        "title": "최고 고수 최근 7일 응답 시간",
        "price_tokens": 130,
        "description": "누적 적중·예측 횟수 규격을 통과한 전체 무리 안에서 적중률 1순위인 사람을 하나 고르고, 그 사람이 해당 7거래일 구간에서 설문을 제출한 시각만 모아 시간대 버킷 분포를 봅니다. 시각 미기록 응답은 제외됩니다.",
    },
    "expert_vote_time_profile": {
        "title": "오늘 정답자들의 투표시간대",
        "price_tokens": 100,
        "description": "해당 거래일 코스피 결과가 확정된 뒤에만 제공됩니다. 그날 맞히고(responded_at 기록 포함) 사람들만 모아 투표시간대별 버킷 비율을 봅니다.",
    },
    "novice_vote_time_profile": {
        "title": "오늘 오답자들의 투표시간대",
        "price_tokens": 90,
        "description": "해당 거래일 코스피 결과가 확정된 뒤에만 제공됩니다. 그날 틀린 사람 중 제출 시각이 기록된 응답만 모아 투표시간대별 비율을 봅니다.",
    },
    "expert_leader_pick": {
        "title": "오늘의 고수 픽",
        "price_tokens": 95,
        "description": (
            "지금까지 기준 전역 최고 고수 1명이 그날 설문에 참여했을 때, "
            "그날 선택한 코스피 방향과 설문 게이지(확신도) 규모를 초성 형태 이름과 함께 표시합니다. 매매 조언이 아닙니다."
        ),
    },
    "novice_leader_pick": {
        "title": "오늘의 하수 픽",
        "price_tokens": 85,
        "description": (
            "같은 규격의 하수층에서 누적 적중 최하위(동률 시 id순) 한 명을 고르고, "
            "그날 방향 선택과 게이지(확신도) 규모를 초성 이름과 함께 표시합니다. 게임·비교용입니다."
        ),
    },
}


# 표시 전용 초안 가격(Stripe Price ID는 환경변수로 매핑)
TOKEN_PACKS = [
    {"slug": "pack_300", "tokens": 300, "price_label": "₩2,900", "stripe_price_env": "STRIPE_PRICE_PACK_300"},
    {"slug": "pack_900", "tokens": 900, "price_label": "₩7,900", "stripe_price_env": "STRIPE_PRICE_PACK_900"},
]


def paywall_enabled() -> bool:
    import os
    return os.getenv("INSIGHT_PAYWALL_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")


def stripe_configured() -> bool:
    import os
    return bool(os.getenv("STRIPE_SECRET_KEY", "").strip())
