# -*- coding: utf-8 -*-
"""
텔레그램 봇 모듈 v3
- /start {user_uuid} → 텔레그램 chat_id와 구글 계정 연동
- 매일 22:00 설문 알림 (법정 공휴일 저녁 생략) → 웹 설문 링크만 (확신도 슬라이더는 웹 전용)
- 장 시작 전 집계 결과 공개
- 15:35 개인별 정확도 알림
"""
import os
import logging
import httpx
from dotenv import load_dotenv
from webpush_helper import send_web_push_to_user

load_dotenv()
logger = logging.getLogger(__name__)

from survey_writes import persist_survey_answer, SurveySubmissionLocked, apply_pending_presubmits
from accuracy_aggregate import get_accuracy_data

pending_answers: dict = {}  # 미사용 (단일 질문 전환 후 즉시 저장)


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


def _app_base_url() -> str:
    """웹 설문 슬라이더 링크용"""
    return (os.getenv("PUBLIC_APP_URL") or "https://kospi-prediction-game.vercel.app").rstrip("/")


def _survey_web_url() -> str:
    """웹 설문(슬라이더·1% 단위 확신도). utm 성격으로 src만 붙임."""
    return f"{_app_base_url()}/survey?src=telegram"


def _survey_link_markup() -> dict:
    """인라인 URL 버튼만 (채팅 안에서 확신도 n% 선택은 불가)."""
    return {
        "inline_keyboard": [[
            {"text": "📊 웹 설문 열기 (슬라이더 · 1% 단위)", "url": _survey_web_url()},
        ]],
    }


def _format_gauge_line(gauge: int, tokens_bet: int | None = None) -> str:
    """사용자 확인용 한 줄 요약."""
    dire = "상승 예상" if gauge > 0 else "하락 예상"
    bet = f" · 예상 배팅 약 <b>{tokens_bet}</b>T" if tokens_bet is not None else ""
    return (
        f"방향: <b>{dire}</b>\n"
        f"확신도 레벨: <b>{'+' if gauge > 0 else ''}{gauge}</b>% (등락률 숫자가 아니라, 그 방향에 대한 확신 크기예요){bet}"
    )


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
                f"📊 매일 밤 <b>22:00</b> 무렵 알림에는 <b>웹 설문 링크</b>만 옵니다.\n"
                f"⏰ 장 시작 전(<b>~09:00</b>)까지 웹에서 응답해 주세요.\n"
                f"방향·<b>확신도(슬라이더)</b>는 채팅창 대신 웹에서만 조절할 수 있어요 (1% 단위).\n"
                f"📈 장 마감 후 정확도와 순위도 알려드릴게요!"
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
    """구버전 인라인(오른다/내린다·프리셋) 메시지 호환만 유지 — 신규 알림에는 버튼 없음."""
    query_id = callback_query["id"]
    chat_id = callback_query["from"]["id"]
    message_id = callback_query["message"]["message_id"]
    data = callback_query.get("data", "")

    parts = data.split(":")
    market = None
    date_str = ""
    gauge_position = None

    # 신규: "kospi:g:85:2026-05-05" 또는 "kospi:g:-50:2026-05-05"
    if len(parts) >= 4 and parts[1] == "g":
        market = parts[0]
        try:
            gauge_position = int(parts[2])
        except ValueError:
            await answer_callback_query(query_id, "알 수 없는 확신도 값입니다.")
            return
        date_str = parts[3]
    # 구버전(구 메시지): "kospi:yes:2026-05-05"
    elif len(parts) == 3:
        market, answer, date_str = parts
        if answer == "yes":
            gauge_position = 50
        elif answer == "no":
            gauge_position = -50
        else:
            await answer_callback_query(query_id, "알 수 없는 응답입니다.")
            return
    else:
        await answer_callback_query(query_id, "알 수 없는 응답입니다.")
        return

    if market != "kospi" or not date_str:
        await answer_callback_query(query_id, "알 수 없는 응답입니다.")
        return
    if gauge_position is None or not (-100 <= gauge_position <= 100) or gauge_position == 0:
        await answer_callback_query(query_id, "확신도 값이 올바르지 않습니다.", show_alert=True)
        return

    is_yes = gauge_position > 0
    dir_label = "📈 오른다" if is_yes else "📉 내린다"
    tier = abs(gauge_position)
    tier_word = "강하게" if tier >= 70 else "보통" if tier >= 40 else "살짝"
    label = f"{dir_label} · {tier_word} 확신 ({'+' if gauge_position > 0 else ''}{gauge_position})"

    # 설문 마감 여부 확인
    survey = supabase.table("daily_surveys").select("is_closed").eq("survey_date", date_str).execute()
    if survey.data and survey.data[0]["is_closed"]:
        await answer_callback_query(query_id, "⏰ 설문이 마감되었습니다 (09:00 이후)", show_alert=True)
        return

    survey_closed = bool(survey.data[0]["is_closed"]) if survey.data else False

    # 유저 조회
    user_res = supabase.table("users").select("id").eq("telegram_chat_id", chat_id).execute()
    if not user_res.data:
        await answer_callback_query(query_id, "연동된 계정을 찾을 수 없습니다.", show_alert=True)
        return

    user_id = user_res.data[0]["id"]

    try:
        apply_pending_presubmits(supabase, str(user_id))
        try:
            out = persist_survey_answer(
                supabase,
                str(user_id),
                date_str,
                gauge_position,
                survey_closed=survey_closed,
            )
        except SurveySubmissionLocked as e:
            await answer_callback_query(query_id, e.detail[:180], show_alert=True)
            return

        tokens_bet = out.get("tokens_bet")
        summary = _format_gauge_line(gauge_position, tokens_bet)
        await edit_message_text(chat_id, message_id, f"✅ <b>코스피</b> 선택 완료\n{label}")
        await answer_callback_query(query_id, f"저장했어요 · {dir_label}")
        await send_message(
            chat_id,
            f"✅ <b>예측 완료!</b>\n\n{summary}\n\n"
            f"📊 09:00에 집계 결과를 알려드립니다!",
        )
    except Exception as e:
        logger.exception("응답 저장 오류")
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

async def send_daily_survey_to_all(supabase, date_str: str, is_reminder: bool = False) -> None:
    """텔레그램 연동 유저 전원에게 코스피 예측 설문 발송
    is_reminder=True: 08:48 마감임박 리마인더 / False: 22:00 신규 설문
    """
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
            if is_reminder:
                msg = (
                    f"⏰ <b>마감 임박!</b> ({date_str})\n"
                    f"<b>09:00</b> 마감 전까지 웹 설문을 완료해 주세요.\n\n"
                    f"<b>확신도(슬라이더)</b>는 채팅에서는 못 고르니, 반드시 아래 버튼으로 <b>웹</b>에서 맞춰 주세요.\n"
                    f"(상승/하락 방향별로 1% 단위까지 조절 가능)"
                )
            else:
                msg = (
                    f"📊 <b>내일 코스피 예측</b> ({date_str})\n"
                    f"아래 버튼으로 <b>웹 설문</b>을 열어 주세요.\n\n"
                    f"텔레그램 대화창만으로는 슬라이더처럼 <b>1% 단위 확신도</b>를 줄 수 없어,\n"
                    f"방향·확신도·배팅은 모두 <b>웹</b>에서만 설정합니다.\n"
                    f"⏰ 마감: 내일 <b>09:00</b>"
                )
            await send_message(chat_id, msg, _survey_link_markup())
            sent += 1
        except Exception as e:
            logger.error(f"설문 발송 실패 (chat_id={chat_id}): {e}")

    logger.info(f"설문 {'리마인더' if is_reminder else '신규'} 발송 완료: {sent}명")


def _calc_weighted_pct_tg(responses_data: list, accuracy_map: dict) -> int:
    """가중예측치 계산 (코스피 단일)"""
    kospi_score = kospi_w = 0.0
    for r in responses_data:
        acc = accuracy_map.get(str(r["user_id"]), 0.5)
        weight = (acc - 0.5) * 2
        if weight == 0.0:
            weight = 1.0
        kospi_vote = 1 if r["kospi_answer"] else -1
        kospi_score += weight * kospi_vote
        kospi_w += abs(weight)
    return round((kospi_score / kospi_w + 1) / 2 * 100) if kospi_w > 0 else 50


async def announce_results(supabase, date_str: str) -> None:
    """09:00 - 집계 결과 발표 (응답자 전원에게)"""
    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", date_str)
        .execute()
    )

    total = len(responses.data)
    if total == 0:
        logger.info("오늘 응답자 없음 - 결과 발표 생략")
        return

    kospi_yes = sum(1 for r in responses.data if r["kospi_answer"])
    kospi_pct = round(kospi_yes / total * 100)

    acc_map, _, _ = get_accuracy_data(supabase)
    kospi_wpct = _calc_weighted_pct_tg(responses.data, acc_map)

    def bar(pct: int) -> str:
        filled = pct // 10
        return "█" * filled + "░" * (10 - filled)

    result_text = (
        f"📊 <b>오늘의 장 예측 집계</b> ({date_str})\n"
        f"총 <b>{total}명</b> 참여\n\n"
        f"<b>📈 코스피</b>\n"
        f"{bar(kospi_pct)}\n"
        f"오른다 <b>{kospi_pct}%</b> vs 내린다 <b>{100 - kospi_pct}%</b>\n"
        f"⭐ 고수 강화예측: 오른다 <b>{kospi_wpct}%</b>\n\n"
        f"💡 <i>강화예측은 정확도 높은 고수들의 의견을 더 반영한 예측입니다.</i>\n"
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
) -> None:
    """15:35 - 장 마감 후 개인별 정확도 및 순위 알림"""
    accuracy_records = (
        supabase.table("accuracy_records")
        .select("user_id, kospi_correct")
        .eq("survey_date", date_str)
        .execute()
    )

    if not accuracy_records.data:
        return

    _, _, user_scores = get_accuracy_data(supabase)

    total_users = len(user_scores)
    kospi_sign = "+" if kospi_up else ""
    kospi_dir = "▲" if kospi_up else "▼"

    for record in accuracy_records.data:
        user_id = record["user_id"]
        user = supabase.table("users").select("telegram_chat_id").eq("id", user_id).execute()

        kospi_correct = record["kospi_correct"]

        my_score = user_scores.get(str(user_id), {"correct": 0, "total": 0})
        my_rate = my_score["correct"] / my_score["total"] if my_score["total"] > 0 else 0

        users_with_lower = sum(
            1 for uid, s in user_scores.items()
            if s["total"] > 0 and s["correct"] / s["total"] < my_rate
        )
        top_pct = round((1 - users_with_lower / total_users) * 100) if total_users > 1 else 100
        overall_pct = round(my_rate * 100)

        k_emoji = "✅" if kospi_correct else "❌"
        k_result = "맞음" if kospi_correct else "틀림"

        # 텔레그램 알림
        if user.data and user.data[0].get("telegram_chat_id"):
            chat_id = user.data[0]["telegram_chat_id"]
            text = (
                f"📈 <b>오늘 장 마감 결과</b>\n\n"
                f"코스피 {kospi_dir} {kospi_sign}{kospi_pct}%\n\n"
                f"<b>내 예측:</b> {k_emoji} {k_result}\n\n"
                f"📊 누적 정확도: <b>{overall_pct}%</b>\n"
                f"🏆 현재 순위: <b>상위 {top_pct}%</b>"
            )
            try:
                await send_message(chat_id, text)
            except Exception as e:
                logger.error(f"정확도 알림 실패 (chat_id={chat_id}): {e}")

        # 웹 푸시 알림
        push_body = f"내 예측 {k_emoji} {k_result} · 누적 적중률 {overall_pct}% (상위 {top_pct}%)"
        send_web_push_to_user(supabase, user_id, "📊 오늘 장 마감 결과", push_body, "/dashboard", notif_type="result")


async def notify_challenge_results(supabase, date_str: str) -> None:
    """15:35 대결 결과 처리 및 양측 알림"""
    acc_rows = (
        supabase.table("accuracy_records")
        .select("user_id, kospi_correct")
        .eq("survey_date", date_str)
        .execute()
    )
    if not acc_rows.data:
        return

    acc_map = {r["user_id"]: r["kospi_correct"] for r in acc_rows.data}

    challenges = (
        supabase.table("challenges")
        .select("*")
        .eq("survey_date", date_str)
        .eq("outcome", "pending")
        .eq("accepted", True)   # 수락된 대결만 결과 처리
        .execute()
    )
    if not challenges.data:
        return

    for ch in challenges.data:
        c1_id = ch["challenger_id"]
        c2_id = ch["challenged_id"]

        if c1_id not in acc_map or c2_id not in acc_map:
            supabase.table("challenges").update({"outcome": "no_result"}).eq("id", ch["id"]).execute()
            continue

        c1_correct = acc_map[c1_id]
        c2_correct = acc_map[c2_id]

        if c1_correct == c2_correct:
            outcome = "tie"
        elif c1_correct:
            outcome = "challenger_wins"
        else:
            outcome = "challenged_wins"

        supabase.table("challenges").update({"outcome": outcome}).eq("id", ch["id"]).execute()

        def _masked_name(uid):
            row = supabase.table("users").select("name").eq("id", uid).execute()
            n = row.data[0]["name"] if row.data else "익명"
            return (n[0] + "**") if n else "익명"

        c1_masked = _masked_name(c1_id)
        c2_masked = _masked_name(c2_id)

        def _result_texts(my_correct, opp_masked, i_won, is_tie):
            if is_tie:
                title = "🤝 대결 비김!"
                body = f"vs {opp_masked} · 둘 다 {'맞혔어요' if my_correct else '틀렸어요'}"
                tg = (
                    f"⚔️ <b>대결 결과</b>\n\nvs <b>{opp_masked}</b>\n\n"
                    f"🤝 <b>비겼어요!</b>\n{body.split(' · ')[1]}"
                )
            elif i_won:
                title = "🏆 대결 승리!"
                body = f"vs {opp_masked} · 오늘 예측 대결에서 이겼어요! 🎉"
                tg = (
                    f"⚔️ <b>대결 결과</b>\n\nvs <b>{opp_masked}</b>\n\n"
                    f"🏆 <b>승리!</b>\n오늘 예측 대결에서 이겼어요! 🎉"
                )
            else:
                title = "😢 대결 패배"
                body = f"vs {opp_masked} · 오늘은 상대가 더 정확했어요. 내일 도전! 💪"
                tg = (
                    f"⚔️ <b>대결 결과</b>\n\nvs <b>{opp_masked}</b>\n\n"
                    f"😢 <b>패배!</b>\n오늘은 상대가 더 정확했어요. 내일 다시 도전! 💪"
                )
            return title, body, tg

        is_tie = (outcome == "tie")
        c1_wins = (outcome == "challenger_wins")

        c1_title, c1_body, c1_tg = _result_texts(c1_correct, c2_masked, c1_wins, is_tie)
        c2_title, c2_body, c2_tg = _result_texts(c2_correct, c1_masked, not c1_wins and not is_tie, is_tie)

        c1_row = supabase.table("users").select("telegram_chat_id").eq("id", c1_id).execute()
        if c1_row.data and c1_row.data[0].get("telegram_chat_id"):
            try:
                await send_message(c1_row.data[0]["telegram_chat_id"], c1_tg)
            except Exception as e:
                logger.error(f"대결 결과 텔레그램 실패(c1): {e}")
        send_web_push_to_user(supabase, c1_id, c1_title, c1_body, "/dashboard", notif_type="challenge")

        c2_row = supabase.table("users").select("telegram_chat_id").eq("id", c2_id).execute()
        if c2_row.data and c2_row.data[0].get("telegram_chat_id"):
            try:
                await send_message(c2_row.data[0]["telegram_chat_id"], c2_tg)
            except Exception as e:
                logger.error(f"대결 결과 텔레그램 실패(c2): {e}")
        send_web_push_to_user(supabase, c2_id, c2_title, c2_body, "/dashboard", notif_type="challenge")
