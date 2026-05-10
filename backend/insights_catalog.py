# -*- coding: utf-8 -*-
"""
단일 재화 플랜(옵션 A): 게임과 동일 users.tokens 로 인사이트 열람 차감.
예: 고수·다수결 괴리, 같은 편 속 내 확신도 위치 등.
"""

INSIGHT_PRODUCTS = {
    "daily_expert_gap": {
        "title": "고수·다수결 차이 스냅샷",
        "price_tokens": 120,
        "description": "집단의 단순 다수결 비율과 가중예측(누적 적중 반영)의 차이 요약입니다. 과거 거래일도 날짜별로 같은 방식으로 열람합니다. 매매·투자 조언이 아니며 개인별 응답은 포함하지 않습니다.",
    },
    "my_gauge_vs_crowd": {
        "title": "내 확신도, 같은 편 속 위치",
        "price_tokens": 80,
        "description": "그날 같은 방향(상승·하락)으로 예측한 참가자 중에서 내 확신(게이지)이 얼마나 강한지 집계로 보여 줍니다. 매매·투자 조언이 아닙니다.",
    },
    "crowd_conviction_spread": {
        "title": "무리 확신(게이지) 분포 한 장",
        "price_tokens": 60,
        "description": "그날 참가자들의 게이지(확신 방향·세기) 분포를 평균·편차·분위 등으로 요약합니다. 개인별 응답은 보이지 않습니다. 교육·게임 회고용이며 투자 권유가 아닙니다.",
    },
    "rolling_crowd_summary": {
        "title": "최근 7거래일 무리 요약",
        "price_tokens": 140,
        "description": "선택한 날을 끝으로 최근 거래일 7개 구간의 다수결·가중예측(누적 적중 반영)을 한 줄 시계열로 묶었습니다. 일자별 표본 부족이면 해당 일만 빠집니다. 개인별 응답 없음.",
    },
    "group_vs_global_snapshot": {
        "title": "내 그룹 vs 전체 스냅샷",
        "price_tokens": 110,
        "description": "해당 거래일에 내가 속한 그룹 참가자 집합만 따로 묶어, 전체 무리와 같은 축(다수결 vs 가중)으로 한 장 비교합니다. 그룹 응답이 일정 인원 미만이면 제공하지 않습니다.",
    },
    "time_slice_accuracy": {
        "title": "시간대별 응답·적중 무드",
        "price_tokens": 130,
        "description": "그날 응답 시각(KST)을 버킷으로 묶어 분포를 보여 주며, 해당일 코스피 결과가 확정된 뒤에는 버킷별 적중 비율을 덧붙입니다. 시각 미기록 응답은 제외합니다. 교육·게임 회고용이며 투자 조언이 아닙니다.",
    },
    "expert_vote_time_profile": {
        "title": "고수층 투표 시간 분포 한 장",
        "price_tokens": 100,
        "description": "누적 적중 프로필로 정의된 고수층만 따로 묶어, 그날 투표가 몰린 KST 시간대를 전체 무리와 비교한 요약입니다. 최소 표본 규칙을 만족할 때만 열람됩니다.",
    },
    "novice_vote_time_profile": {
        "title": "하수층 투표 시간 분포 한 장",
        "price_tokens": 90,
        "description": "고수층과 동일 규약의 하위 층에 대한 대칭 비교 카드입니다. 비하 표현 없이 시간대 집계만 제공합니다.",
    },
    "expert_leader_pick": {
        "title": "오늘의 고수 1위 픽",
        "price_tokens": 95,
        "description": (
            "해당 거래일 설문에 응답했고 규격에 들어간 고수층 가운데, "
            "누적 적중률 1순위(동률 시 사용자 id순) 한 명의 코스피 예측 방향만 표시합니다. "
            "닉네임은 초성 형태로만 표시합니다. 투자·매매 조언이 아닙니다."
        ),
    },
    "novice_leader_pick": {
        "title": "오늘의 하수 1위 픽",
        "price_tokens": 85,
        "description": (
            "고수 규격과 같은 방식으로 정의된 하수층 응답자 중에서, "
            "누적 적중률이 가장 낮은 순위(동률 시 id순) 한 명의 그날 코스피 예측 방향을 보여 줍니다. "
            "비교·게임용이며 개인 비하 목적의 표현 없이 표시합니다. 투자·매매 조언이 아닙니다."
        ),
    },
}

# 표시 전용 초안 가격(Strripe Price ID는 환경변수로 매핑)
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
