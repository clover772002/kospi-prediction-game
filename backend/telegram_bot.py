# -*- coding: utf-8 -*-
"""
텔레그램 봇 모듈 v3
- /start {user_uuid} → 텔레그램 chat_id와 구글 계정 연동
- 매일 08:50 코스피/코스닥 O/X 설문 발송
- 09:00 집계 결과 발표
- 15:35 개인별 정확도 알림
"""
import os
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# 임시 응답 저장소: "{chat_id}:{date_str}" → {"kospi": bool|None, "kosdaq": bool|None}
# 두 답변이 모두 완료되면 DB에 저장 후 삭제
pending_answers: dict = {}


def _token() -> str:
    t = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not t:
        logger.error("TELEGRAM_BOT_TOKEN이 비어 있습니다.")
    return t


def _api(path: str) -> str:
    return f"https://api.telegram.org/bot{_token()}/{path}"


async def send_message(chat_id: int | str, text: str, reply_markup: dict = None) -> dict:
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(_api("sendMessage"), json=payload)
        logger.info(f"sendMessage → {chat_id}: {resp.status_code}")
        return resp.json()


async def edit_message_text(chat_id: int | str, message_id: int, text: str) -> dict:
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(_api("editMessageText"), json=payload)
        return resp.json()


async def answer_callback_query(callback_query_id: str, text: str = "", show_alert: bool = False):
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(_api("answerCallbackQuery"), json={
            "callback_query_id": callback_query_id,
            "text": text,
            "show_alert": show_alert,
        })


def _survey_keyboard(market: str, date_str: str) -> dict:
    """코스피/코스닥 예측 인라인 버튼"""
    return {
        "inline_keyboard": [[
            {"text": "📈 오른다", "callback_data": f"{market}:yes:{date_str}"},
            {"text": "📉 내린다", "callback_data": f"{market}:no:{date_str}"},
        ]]
    }


# ─────────────────────────────────────────────────────────────
# 핸들러
# ─────────────────────────────────────────────────────────────

async def handle_start(chat_id: int, user_id_param: str, supabase) -> None:
    """/start {user_uuid} → telegram_chat_id 연동"""
    if not user_id_param:
        await send_message(chat_id,
            "👋 안녕하세요!\n\n"
            "웹사이트에서 구글 로그인 후 연동 버튼을 눌러주세요."
        )
        return

    try:
        # 먼저 대상 유저가 users 테이블에 없으면 Supabase Auth에서 가져와 삽입
        existing = supabase.table("users").select("id").eq("id", user_id_param).execute()
        if not existing.data:
            try:
                auth_user = supabase.auth.admin.get_user_by_id(user_id_param)
                if auth_user and auth_user.user:
                    u = auth_user.user
                    meta = u.user_metadata or {}
                    supabase.table("users").upsert({
                        "id": str(u.id),
                        "email": u.email or "",
                        "name": meta.get("full_name") or meta.get("name") or "",
                        "picture": meta.get("avatar_url") or meta.get("picture") or "",
                    }).execute()
            except Exception as e2:
                logger.warning(f"Auth 유저 조회 실패: {e2}")

        # 기존에 같은 telegram_chat_id를 가진 다른 유저의 연동 해제
        supabase.table("users").update(
            {"telegram_chat_id": None}
        ).eq("telegram_chat_id", chat_id).neq("id", user_id_param).execute()

        # 현재 유저에 telegram_chat_id 연동
        result = supabase.table("users").update(
            {"telegram_chat_id": chat_id}
        ).eq("id", user_id_param).execute()

        if result.data:
            user = result.data[0]
            name = user.get("name") or user.get("email", "투자자")
            await send_message(chat_id,
                f"✅ <b>연동 완료!</b>\n\n"
                f"안녕하세요, {name}님!\n\n"
                f"📊 매일 <b>08:50</b>에 코스피·코스닥 예측 설문이 발송됩니다.\n"
                f"⏰ <b>09:00</b>까지만 응답 가능합니다.\n"
                f"📈 장 마감 후 정확도와 순위를 알려드릴게요!"
            )
        else:
            await send_message(chat_id,
                "❌ 연동 실패: 올바른 링크를 사용해주세요.\n"
                "웹사이트에서 다시 연동 링크를 발급받아 주세요."
            )
    except Exception as e:
        logger.error(f"텔레그램 연동 오류: {e}")
        await send_message(chat_id, "❌ 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")


async def handle_callback_query(callback_query: dict, supabase) -> None:
    """인라인 버튼 응답 처리 (코스피/코스닥 O/X)"""
    query_id = callback_query["id"]
    chat_id = callback_query["from"]["id"]
    message_id = callback_query["message"]["message_id"]
    data = callback_query.get("data", "")

    # data format: "kospi:yes:2026-05-05" or "kosdaq:no:2026-05-05"
    parts = data.split(":")
    if len(parts) != 3:
        await answer_callback_query(query_id, "알 수 없는 응답입니다.")
        return

    market, answer, date_str = parts
    is_yes = (answer == "yes")
    label = "📈 오른다" if is_yes else "📉 내린다"
    market_label = "코스피" if market == "kospi" else "코스닥"

    # 설문 마감 여부 확인
    survey = supabase.table("daily_surveys").select("is_closed").eq("survey_date", date_str).execute()
    if survey.data and survey.data[0]["is_closed"]:
        await answer_callback_query(query_id, "⏰ 설문이 마감되었습니다 (09:00 이후)", show_alert=True)
        return

    # 유저 조회
    user_res = supabase.table("users").select("id").eq("telegram_chat_id", chat_id).execute()
    if not user_res.data:
        await answer_callback_query(query_id, "연동된 계정을 찾을 수 없습니다.", show_alert=True)
        return

    user_id = user_res.data[0]["id"]
    key = f"{chat_id}:{date_str}"

    if key not in pending_answers:
        pending_answers[key] = {"kospi": None, "kosdaq": None}

    pending_answers[key][market] = is_yes

    # 선택 완료 표시로 메시지 수정
    seq = "1️⃣" if market == "kospi" else "2️⃣"
    await edit_message_text(chat_id, message_id, f"{seq} <b>{market_label}</b> → {label} ✅")
    await answer_callback_query(query_id, f"{market_label}: {label}")

    # 코스피 응답 후 코스닥 질문 발송
    if market == "kospi" and pending_answers[key]["kosdaq"] is None:
        await send_message(chat_id,
            "2️⃣ <b>코스닥</b>이 오늘 오를까요?",
            _survey_keyboard("kosdaq", date_str)
        )

    # 두 답변 모두 완료 시 DB 저장
    answers = pending_answers[key]
    if answers["kospi"] is not None and answers["kosdaq"] is not None:
        try:
            supabase.table("survey_responses").upsert({
                "user_id": user_id,
                "survey_date": date_str,
                "kospi_answer": answers["kospi"],
                "kosdaq_answer": answers["kosdaq"],
            }).execute()

            k_label = "📈 오른다" if answers["kospi"] else "📉 내린다"
            q_label = "📈 오른다" if answers["kosdaq"] else "📉 내린다"

            await send_message(chat_id,
                f"✅ <b>예측 완료!</b>\n\n"
                f"코스피: {k_label}\n"
                f"코스닥: {q_label}\n\n"
                f"📊 09:00에 집계 결과를 알려드립니다!"
            )
            del pending_answers[key]

        except Exception as e:
            logger.error(f"응답 저장 오류: {e}")
            await send_message(chat_id, "❌ 응답 저장 중 오류가 발생했습니다. 다시 시도해주세요.")


async def handle_webhook(update: dict, supabase) -> None:
    """텔레그램 웹훅 라우팅"""
    if "message" in update:
        msg = update["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "")

        if text.startswith("/start"):
            parts = text.split(" ", 1)
            user_id_param = parts[1].strip() if len(parts) > 1 else ""
            await handle_start(chat_id, user_id_param, supabase)

    elif "callback_query" in update:
        await handle_callback_query(update["callback_query"], supabase)


# ─────────────────────────────────────────────────────────────
# 스케줄러에서 호출하는 함수들
# ─────────────────────────────────────────────────────────────

async def send_daily_survey_to_all(supabase, date_str: str) -> None:
    """08:50 - 텔레그램 연동 유저 전원에게 코스피 예측 설문 발송"""
    users = (
        supabase.table("users")
        .select("telegram_chat_id")
        .not_.is_("telegram_chat_id", "null")
        .execute()
    )

    sent = 0
    for user in users.data:
        chat_id = user["telegram_chat_id"]
        try:
            await send_message(
                chat_id,
                f"📊 <b>오늘의 장 예측</b> ({date_str})\n"
                f"⏰ 설문 마감: 09:00\n\n"
                f"1️⃣ <b>코스피</b>가 오늘 오를까요?",
                _survey_keyboard("kospi", date_str)
            )
            sent += 1
        except Exception as e:
            logger.error(f"설문 발송 실패 (chat_id={chat_id}): {e}")

    logger.info(f"설문 발송 완료: {sent}명")


async def announce_results(supabase, date_str: str) -> None:
    """09:00 - 집계 결과 발표 (응답자 전원에게)"""
    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer, kosdaq_answer")
        .eq("survey_date", date_str)
        .execute()
    )

    total = len(responses.data)
    if total == 0:
        logger.info("오늘 응답자 없음 - 결과 발표 생략")
        return

    kospi_yes = sum(1 for r in responses.data if r["kospi_answer"])
    kosdaq_yes = sum(1 for r in responses.data if r["kosdaq_answer"])
    kospi_pct = round(kospi_yes / total * 100)
    kosdaq_pct = round(kosdaq_yes / total * 100)

    def bar(pct: int) -> str:
        filled = pct // 10
        return "█" * filled + "░" * (10 - filled)

    result_text = (
        f"📊 <b>오늘의 장 예측 집계</b> ({date_str})\n"
        f"총 <b>{total}명</b> 참여\n\n"
        f"<b>📈 코스피</b>\n"
        f"{bar(kospi_pct)}\n"
        f"오른다 <b>{kospi_pct}%</b> vs 내린다 <b>{100 - kospi_pct}%</b>\n\n"
        f"<b>📈 코스닥</b>\n"
        f"{bar(kosdaq_pct)}\n"
        f"오른다 <b>{kosdaq_pct}%</b> vs 내린다 <b>{100 - kosdaq_pct}%</b>\n\n"
        f"⏳ 실제 결과는 장 마감 후 알려드립니다."
    )

    for resp in responses.data:
        user = (
            supabase.table("users")
            .select("telegram_chat_id")
            .eq("id", resp["user_id"])
            .execute()
        )
        if user.data and user.data[0]["telegram_chat_id"]:
            try:
                await send_message(user.data[0]["telegram_chat_id"], result_text)
            except Exception as e:
                logger.error(f"결과 발표 실패: {e}")


async def send_accuracy_notifications(
    supabase,
    date_str: str,
    kospi_up: bool,
    kospi_pct: float,
    kosdaq_up: bool,
    kosdaq_pct: float,
) -> None:
    """15:35 - 장 마감 후 개인별 정확도 및 순위 알림"""
    accuracy_records = (
        supabase.table("accuracy_records")
        .select("user_id, kospi_correct, kosdaq_correct")
        .eq("survey_date", date_str)
        .execute()
    )

    if not accuracy_records.data:
        return

    # 전체 유저 누적 정확도 계산 (상위 퍼센트 계산용)
    all_acc = supabase.table("accuracy_records").select("user_id, kospi_correct, kosdaq_correct").execute()
    user_scores: dict = {}
    for r in all_acc.data:
        uid = r["user_id"]
        if uid not in user_scores:
            user_scores[uid] = {"correct": 0, "total": 0}
        user_scores[uid]["correct"] += (1 if r.get("kospi_correct") else 0) + (1 if r.get("kosdaq_correct") else 0)
        user_scores[uid]["total"] += 2

    total_users = len(user_scores)

    kospi_sign = "+" if kospi_up else ""
    kosdaq_sign = "+" if kosdaq_up else ""
    kospi_dir = "▲" if kospi_up else "▼"
    kosdaq_dir = "▲" if kosdaq_up else "▼"

    for record in accuracy_records.data:
        user_id = record["user_id"]
        user = supabase.table("users").select("telegram_chat_id").eq("id", user_id).execute()
        if not user.data or not user.data[0]["telegram_chat_id"]:
            continue

        chat_id = user.data[0]["telegram_chat_id"]
        kospi_correct = record["kospi_correct"]
        kosdaq_correct = record["kosdaq_correct"]

        my_score = user_scores.get(user_id, {"correct": 0, "total": 0})
        my_rate = my_score["correct"] / my_score["total"] if my_score["total"] > 0 else 0

        users_with_lower = sum(
            1 for uid, s in user_scores.items()
            if s["total"] > 0 and s["correct"] / s["total"] < my_rate
        )
        top_pct = round((1 - users_with_lower / total_users) * 100) if total_users > 1 else 100
        overall_pct = round(my_rate * 100)

        k_emoji = "✅" if kospi_correct else "❌"
        q_emoji = "✅" if kosdaq_correct else "❌"
        k_result = "맞음" if kospi_correct else "틀림"
        q_result = "맞음" if kosdaq_correct else "틀림"

        text = (
            f"📈 <b>오늘 장 마감 결과</b>\n\n"
            f"코스피 {kospi_dir} {kospi_sign}{kospi_pct}%\n"
            f"코스닥 {kosdaq_dir} {kosdaq_sign}{kosdaq_pct}%\n\n"
            f"<b>내 예측</b>\n"
            f"코스피: {k_emoji} {k_result}\n"
            f"코스닥: {q_emoji} {q_result}\n\n"
            f"📊 누적 정확도: <b>{overall_pct}%</b>\n"
            f"🏆 현재 순위: <b>상위 {top_pct}%</b>"
        )

        try:
            await send_message(chat_id, text)
        except Exception as e:
            logger.error(f"정확도 알림 실패 (chat_id={chat_id}): {e}")
