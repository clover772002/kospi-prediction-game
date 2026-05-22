-- 일일 단톡방 (상승·하락 한 방) — Supabase SQL Editor에서 실행
-- room 키: survey_date. side 컬럼은 작성자 예측 방향(표시용)만 사용.

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
    '거래일 단톡 메시지(한 방). side=작성자 상승/하락 표시. 해당일 설문 참여자만 API 접근.';

CREATE INDEX IF NOT EXISTS idx_direction_room_messages_day_time
    ON public.direction_room_messages (survey_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direction_room_messages_user_day
    ON public.direction_room_messages (user_id, survey_date);
