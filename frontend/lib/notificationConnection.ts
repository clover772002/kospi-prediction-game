import type { UserProfile } from "@/lib/api";

/** 텔레그램 또는 브라우저 푸시 구독이 DB에 있는지 (설정 화면과 동일 기준) */
export function isNotificationConnected(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.telegram_chat_id != null && profile.telegram_chat_id !== 0) {
    return true;
  }
  return Boolean(profile.has_push);
}

export function mergeNotificationFields(
  prev: UserProfile | null,
  fresh: UserProfile,
): UserProfile {
  if (!prev) return fresh;
  return {
    ...prev,
    telegram_chat_id: fresh.telegram_chat_id,
    has_push: fresh.has_push,
    push_preferences: fresh.push_preferences ?? prev.push_preferences,
  };
}
