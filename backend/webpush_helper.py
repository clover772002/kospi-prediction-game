"""웹 푸시 알림 발송 헬퍼"""
import os
import json
import base64
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:forsmartonly@gmail.com")

# 알림 종류 목록 (이 키는 push_preferences JSONB에서 사용)
NOTIF_TYPES = {
    "survey_open":    "설문 시작 알림 (22:00)",
    "survey_deadline":"마감 임박 알림 (08:45)",
    "result":         "실적·정확도 알림 (15:35)",
    "challenge":      "대결 신청·결과 알림",
    "group_nudge":    "그룹 독촉 알림",
    "expert_chat":    "고수 소통(질문·답장) 알림",
    "direction_chat": "소통방 새 메시지 알림",
}

def _load_vapid_private_key() -> str:
    key = os.getenv("VAPID_PRIVATE_KEY", "")
    if not key:
        return key
    if key.startswith("-----"):
        return key
    try:
        padding = (4 - len(key) % 4) % 4
        decoded = base64.b64decode(key + "=" * padding).decode("utf-8")
        if decoded.startswith("-----"):
            logger.info("VAPID 개인키 base64 디코딩 성공")
            return decoded
    except Exception as e:
        logger.error(f"VAPID 개인키 base64 디코딩 실패: {e}")
    return key

VAPID_PRIVATE_KEY = _load_vapid_private_key()


def _allowed(preferences: dict | None, notif_type: str | None) -> bool:
    """유저 preferences에서 해당 알림 종류가 허용돼 있는지 확인. 기본값=True."""
    if notif_type is None:
        return True
    if not preferences:
        return True
    return preferences.get(notif_type, True)


def send_web_push(subscription_info: dict, title: str, body: str, url: str = "/dashboard", notif_type: str | None = None) -> bool | str:
    """단일 구독자에게 웹 푸시 전송. 성공 True, 만료 'expired', 그 외 False."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY 미설정 — 웹 푸시 생략")
        return False
    try:
        payload = {"title": title, "body": body, "url": url}
        if notif_type:
            payload["type"] = notif_type
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
        )
        return True
    except WebPushException as e:
        status = e.response.status_code if e.response else "N/A"
        logger.error(f"웹 푸시 실패 (status={status}): {e}")
        if e.response is not None and e.response.status_code in (404, 410):
            return "expired"
        return False
    except Exception as e:
        logger.error(f"웹 푸시 오류: {e}")
        return False


def _clear_push_subscription(supabase, user_id: str) -> None:
    try:
        supabase.table("users").update({"push_subscription": None}).eq("id", user_id).execute()
        logger.info("만료된 push_subscription 제거 user=%s", user_id)
    except Exception as e:
        logger.error("push_subscription 제거 실패 user=%s: %s", user_id, e)


def send_web_push_to_user(
    supabase,
    user_id: str,
    title: str,
    body: str,
    url: str = "/dashboard",
    notif_type: str | None = None,
) -> bool:
    """특정 유저 한 명에게 웹 푸시 전송. preferences로 차단된 종류면 생략."""
    try:
        row = supabase.table("users").select("push_subscription, push_preferences").eq("id", user_id).execute()
        if not row.data or not row.data[0].get("push_subscription"):
            return False
        prefs = row.data[0].get("push_preferences") or {}
        if isinstance(prefs, str):
            prefs = json.loads(prefs)
        if not _allowed(prefs, notif_type):
            logger.info(f"웹 푸시 생략 (user={user_id}, type={notif_type}, 사용자 비활성)")
            return False
        sub = row.data[0]["push_subscription"]
        if isinstance(sub, str):
            sub = json.loads(sub)
        ok = send_web_push(sub, title, body, url, notif_type)
        if ok == "expired":
            _clear_push_subscription(supabase, user_id)
            return False
        return bool(ok)
    except Exception as e:
        logger.error(f"웹 푸시 단일 발송 오류 (user={user_id}): {e}")
        return False


async def send_web_push_to_all(
    supabase,
    title: str,
    body: str,
    url: str = "/dashboard",
    notif_type: str | None = None,
) -> int:
    """push_subscription이 있는 모든 유저에게 웹 푸시 전송. preferences 필터 적용."""
    try:
        users = supabase.table("users").select("id, push_subscription, push_preferences").not_.is_("push_subscription", "null").execute()
    except Exception as e:
        logger.error(f"웹 푸시 구독자 조회 오류: {e}")
        return 0

    logger.info(f"웹 푸시 구독자 {len(users.data)}명 발견")

    sent = 0
    for user in users.data:
        sub = user.get("push_subscription")
        if not sub:
            continue
        prefs = user.get("push_preferences") or {}
        if isinstance(prefs, str):
            try:
                prefs = json.loads(prefs)
            except Exception:
                prefs = {}
        if not _allowed(prefs, notif_type):
            logger.info(f"웹 푸시 생략 (user={user.get('id')}, type={notif_type})")
            continue
        if isinstance(sub, str):
            try:
                sub = json.loads(sub)
            except Exception as e:
                logger.error(f"유저 {user.get('id')}: push_subscription JSON 파싱 오류 {e}")
                continue
        logger.info(f"유저 {user.get('id')} 푸시 발송 시도")
        result = send_web_push(sub, title, body, url, notif_type)
        if result == "expired":
            uid = user.get("id")
            if uid:
                _clear_push_subscription(supabase, str(uid))
        elif result:
            sent += 1

    logger.info(f"웹 푸시 발송 완료: {sent}명")
    return sent
