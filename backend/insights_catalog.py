# -*- coding: utf-8 -*-
"""
단일 재화 플랜(옵션 A): 게임과 동일 users.tokens 로 인사이트 열람 차감.
첫 SKU: 해당 거래일 고수 가중예측 vs 단순 다수결 괴리 리포트.
"""

INSIGHT_PRODUCTS = {
    "daily_expert_gap": {
        "title": "고수·다수결 괴리 스냅샷",
        "price_tokens": 80,
        "description": "집단의 단순 다수결 비율과 가중예측(누적 적중 반영)의 차이 요약입니다. 개인별 응답은 포함하지 않습니다.",
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
