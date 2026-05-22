-- 일일 방향 단톡방 (상승팀 / 하락팀) — Supabase SQL Editor에서 실행
-- room 키: survey_date + side ('up' | 'down'), 장 마감(kospi_result 확정) 후 읽기 전용

CREATE TABLE IF NOT EXISTS public.direction_room_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_date  DATE NOT NULL,
    side         TEXT NOT NULL CHECK (side IN ('up', 'down')),
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT direction_room_messages_body_nonempty CHECK (length(trim(body)) > 0),
    CONSTRAINT direction_room_messages_body_len CHECK (char_length(body) <= 500)
);

COMMENT ON TABLE public.direction_room_messages IS
    '거래일·방향별 단톡 메시지. 해당일 설문 참여자만 API로 접근.';

CREATE INDEX IF NOT EXISTS idx_direction_room_messages_room_time
    ON public.direction_room_messages (survey_date, side, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direction_room_messages_user_day
    ON public.direction_room_messages (user_id, survey_date);
