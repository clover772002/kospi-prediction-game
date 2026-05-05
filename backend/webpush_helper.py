"""웹 푸시 알림 발송 헬퍼"""
import os
import json
import base64
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:forsmartonly@gmail.com")

def _load_vapid_private_key() -> str:
    """환경변수에서 VAPID 개인키를 읽어 PEM 문자열로 반환.
    base64로 인코딩된 PEM이면 자동으로 디코딩한다."""
    key = os.getenv("VAPID_PRIVATE_KEY", "")
    if not key:
        return key
    if key.startswith("-----"):
        return key
    try:
        # 패딩 부족 시 자동 보정
        padding = (4 - len(key) % 4) % 4
        decoded = base64.b64decode(key + "=" * padding).decode("utf-8")
        if decoded.startswith("-----"):
            logger.info("VAPID 개인키 base64 디코딩 성공")
            return decoded
    except Exception as e:
        logger.error(f"VAPID 개인키 base64 디코딩 실패: {e}")
    return key

VAPID_PRIVATE_KEY = _load_vapid_private_key()


def send_web_push(subscription_info: dict, title: str, body: str, url: str = "/dashboard") -> bool:
    """단일 구독자에게 웹 푸시 전송. 성공 시 True, 실패 시 False 반환."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY 미설정 — 웹 푸시 생략")
        return False
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
        )
        return True
    except WebPushException as e:
        status = e.response.status_code if e.response else "N/A"
        logger.error(f"웹 푸시 실패 (status={status}): {e}")
        return False
    except Exception as e:
        logger.error(f"웹 푸시 오류: {e}")
        return False


async def send_web_push_to_all(supabase, title: str, body: str, url: str = "/dashboard") -> int:
    """push_subscription이 있는 모든 유저에게 웹 푸시 전송. 성공 수 반환."""
    try:
        users = supabase.table("users").select("id, push_subscription").not_.is_("push_subscription", "null").execute()
    except Exception as e:
        logger.error(f"웹 푸시 구독자 조회 오류: {e}")
        return 0

    logger.info(f"웹 푸시 구독자 {len(users.data)}명 발견")

    sent = 0
    for user in users.data:
        sub = user.get("push_subscription")
        if not sub:
            logger.warning(f"유저 {user.get('id')}: push_subscription 비어있음")
            continue
        if isinstance(sub, str):
            try:
                sub = json.loads(sub)
            except Exception as e:
                logger.error(f"유저 {user.get('id')}: push_subscription JSON 파싱 오류 {e}")
                continue
        logger.info(f"유저 {user.get('id')} 푸시 발송 시도, sub keys={list(sub.keys()) if isinstance(sub, dict) else type(sub)}")
        if send_web_push(sub, title, body, url):
            sent += 1

    logger.info(f"웹 푸시 발송 완료: {sent}명")
    return sent
