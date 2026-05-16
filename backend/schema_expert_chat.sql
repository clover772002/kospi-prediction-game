-- 고수 소통: 스레드·메시지·멱등 키. threads.updated_at 는 백엔드에서 전송 시 갱신합니다.
-- Supabase Dashboard SQL 또는 마이그레이션으로 실행. 서버는 SERVICE_ROLE 로 접근합니다.

CREATE TABLE IF NOT EXISTS public.expert_message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_date DATE NOT NULL,
    participant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expert_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT expert_thread_unique_daily UNIQUE (participant_id, expert_user_id, survey_date),
    CONSTRAINT expert_thread_neq CHECK (participant_id <> expert_user_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_threads_expert_survey ON public.expert_message_threads (expert_user_id, survey_date);
CREATE INDEX IF NOT EXISTS idx_expert_threads_participant ON public.expert_message_threads (participant_id, survey_date);

CREATE TABLE IF NOT EXISTS public.expert_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.expert_message_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    tip_tokens INT NOT NULL DEFAULT 0 CHECK (tip_tokens >= 0),
    tip_accepted_at TIMESTAMPTZ,
    send_idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT expert_messages_body_nonempty CHECK (length(trim(body)) > 0),
    CONSTRAINT expert_messages_body_len CHECK (length(body) <= 2000)
);
COMMENT ON TABLE public.expert_messages IS '스레드 메시지. participant 발송 시 tip_tokens 양수, 고수 답장은 0';

-- 고수가 팁을 수락한 뒤에만 지급(에스크로). 기존 DB에 적용 시 아래 ALTER 한 줄 실행 필요.
ALTER TABLE public.expert_messages ADD COLUMN IF NOT EXISTS tip_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.expert_messages.tip_accepted_at IS 
  '고수가 해당 팁을 수락하여 정산한 시각. NULL이면 참가자에게서만 차감된 상태(대기)';
