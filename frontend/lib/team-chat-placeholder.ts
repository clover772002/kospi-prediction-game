import type { DirectionChatStatus } from "@/lib/api";

/** 소통방 room API 전 서버 페인트용 최소 상태 */
export function buildTeamChatPlaceholder(surveyDate: string): DirectionChatStatus {
  return {
    survey_date: surveyDate.slice(0, 10),
    room_title: "소통방",
    room_open: true,
    room_close_at: null,
    room_seconds_remaining: null,
    room_closed_reason: null,
    answered: false,
    my_side: null,
    my_team_label: null,
    my_masked_name: "…",
    my_display_label: "…",
    member_counts: { up: 0, down: 0, total: 0 },
    max_body_len: 500,
    can_read: true,
    can_send: false,
    send_blocked_reason: null,
  };
}
