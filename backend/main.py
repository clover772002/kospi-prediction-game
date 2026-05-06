# -*- coding: utf-8 -*-
import os
import logging
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

def today_kst() -> str:
    """KST 기준 오늘 날짜 (Railway는 UTC이므로 명시적으로 변환)"""
    return datetime.now(KST).date().isoformat()
from contextlib import asynccontextmanager

import yfinance as yf
import pytz
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from telegram_bot import (
    handle_webhook,
    send_daily_survey_to_all,
    announce_results,
    send_accuracy_notifications,
)
from webpush_helper import send_web_push_to_all

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KST = pytz.timezone("Asia/Seoul")


# ─────────────────────────────────────────────────────────────
# Supabase 클라이언트
# ─────────────────────────────────────────────────────────────

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase 환경변수가 설정되지 않았습니다.")
    return create_client(url, key)


def _supabase_direct() -> Client:
    """스케줄러(FastAPI Depends 미사용)에서 직접 호출용"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


# ─────────────────────────────────────────────────────────────
# JWT 인증
# ─────────────────────────────────────────────────────────────

async def get_current_user(request: Request, supabase: Client = Depends(get_supabase)):
    """Authorization 헤더의 Supabase JWT를 검증하고 유저 객체 반환"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    token = auth[7:]
    try:
        result = supabase.auth.get_user(token)
        if not result or not result.user:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
        return result.user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JWT 검증 오류: {e}")
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")


# ─────────────────────────────────────────────────────────────
# 스케줄러 작업
# ─────────────────────────────────────────────────────────────

async def job_08_45():
    """매일 08:45 - 브라우저 알림 예령 (3분 전 준비 알림)"""
    sb = _supabase_direct()
    await send_web_push_to_all(
        sb,
        title="⏰ 3분 후 설문이 시작돼요!",
        body="08:48에 오늘 코스피 예측 설문이 발송됩니다. 준비하세요 📊",
        url="/survey",
    )
    logger.info("08:45 예령 웹푸시 발송 완료")


async def job_08_50():
    """매일 08:48 - 설문 생성 및 텔레그램 발송"""
    sb = _supabase_direct()
    today_str = today_kst()

    existing = sb.table("daily_surveys").select("id").eq("survey_date", today_str).execute()
    if existing.data:
        logger.info("오늘 설문이 이미 존재함 - 발송 스킵")
        return

    sb.table("daily_surveys").insert({"survey_date": today_str}).execute()
    logger.info(f"설문 생성: {today_str}")

    await send_daily_survey_to_all(sb, today_str)
    await send_web_push_to_all(
        sb,
        title="📊 오늘 장 예측 — 사고 팔자!",
        body=f"코스피·코스닥 오르나 내리나? 탭해서 지금 예측하세요 👆 (마감 09:00)",
        url="/survey",
    )


async def job_09_00():
    """매일 09:00 - 설문 마감 및 집계 결과 발표"""
    sb = _supabase_direct()
    today_str = today_kst()

    sb.table("daily_surveys").update({"is_closed": True}).eq("survey_date", today_str).execute()
    logger.info(f"설문 마감: {today_str}")

    await announce_results(sb, today_str)


async def job_15_35():
    """매일 15:35 - 종가 조회 → 정확도 계산 → 개인별 알림"""
    sb = _supabase_direct()
    today_str = today_kst()

    survey = sb.table("daily_surveys").select("is_closed, kospi_result").eq("survey_date", today_str).execute()
    if not survey.data:
        logger.info("오늘 설문 없음")
        return
    if survey.data[0].get("kospi_result") is not None:
        logger.info("오늘 결과가 이미 저장됨")
        return

    # yfinance 종가 조회 (오늘 Open 대비 Close)
    try:
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        k_hist = yf.Ticker("^KS11").history(start=today_str, end=tomorrow)

        if k_hist.empty:
            logger.warning("yfinance 데이터 없음 - 장이 없는 날(휴장)일 수 있음")
            return

        kospi_open  = float(k_hist["Open"].iloc[-1])
        kospi_close = float(k_hist["Close"].iloc[-1])
        kospi_up    = kospi_close > kospi_open
        kospi_pct   = round((kospi_close / kospi_open - 1) * 100, 2)

        logger.info(f"코스피 {'▲' if kospi_up else '▼'}{kospi_pct}%")

    except Exception as e:
        logger.error(f"yfinance 조회 오류: {e}")
        return

    # DB에 실제 결과 저장
    sb.table("daily_surveys").update({
        "kospi_result": kospi_up,
        "kospi_change_pct": kospi_pct,
    }).eq("survey_date", today_str).execute()

    # 응답자별 정확도 계산
    responses = sb.table("survey_responses").select("user_id, kospi_answer").eq("survey_date", today_str).execute()
    for resp in responses.data:
        sb.table("accuracy_records").upsert({
            "user_id": resp["user_id"],
            "survey_date": today_str,
            "kospi_correct": resp["kospi_answer"] == kospi_up,
        }).execute()

    # 개인별 텔레그램 알림
    await send_accuracy_notifications(sb, today_str, kospi_up, kospi_pct)


# ─────────────────────────────────────────────────────────────
# FastAPI 앱
# ─────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@asynccontextmanager
async def lifespan(app_instance):
    scheduler.add_job(job_08_45, CronTrigger(hour=8,  minute=45, timezone="Asia/Seoul"), id="survey_prebell",  replace_existing=True)
    scheduler.add_job(job_08_50, CronTrigger(hour=8,  minute=48, timezone="Asia/Seoul"), id="survey_open",      replace_existing=True)
    scheduler.add_job(job_09_00, CronTrigger(hour=9,  minute=0,  timezone="Asia/Seoul"), id="survey_close",     replace_existing=True)
    scheduler.add_job(job_15_35, CronTrigger(hour=15, minute=35, timezone="Asia/Seoul"), id="market_result",    replace_existing=True)
    scheduler.start()
    logger.info("스케줄러 시작: 08:45(예령) / 08:48(설문 발송) / 09:00(마감+발표) / 15:35(정확도 알림)")
    yield
    scheduler.shutdown()


app = FastAPI(title="주식 예측 봇 API", version="3.0.0", lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://kospi-prediction-game.vercel.app")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "주식 예측 봇 API 정상 작동 중 📈"}


@app.get("/api/me")
async def get_me(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """현재 로그인 유저 조회 (없으면 자동 생성)"""
    user_id = str(current_user.id)
    meta = current_user.user_metadata or {}

    try:
        existing = supabase.table("users").select("*").eq("id", user_id).execute()
        if not existing.data:
            # 같은 이메일로 다른 OAuth 제공자로 가입한 계정이 있는지 확인
            email_match = supabase.table("users").select("*").eq("email", current_user.email).execute()
            if email_match.data:
                # 기존 계정의 데이터(텔레그램, 푸시 등)를 새 계정에 복사
                old = email_match.data[0]
                supabase.table("users").insert({
                    "id": user_id,
                    "email": current_user.email,
                    "name": meta.get("full_name", old.get("name", "")),
                    "telegram_chat_id": old.get("telegram_chat_id"),
                    "push_subscription": old.get("push_subscription"),
                }).execute()
                row = old.copy()
                row["id"] = user_id
                row["has_push"] = bool(row.get("push_subscription"))
                logger.info(f"중복 이메일 감지 — 기존 계정 데이터 복사: {current_user.email}")
                return row
            else:
                supabase.table("users").insert({
                    "id": user_id,
                    "email": current_user.email,
                    "name": meta.get("full_name", ""),
                }).execute()
                return {
                    "id": user_id,
                    "email": current_user.email,
                    "name": meta.get("full_name", ""),
                    "telegram_chat_id": None,
                    "has_push": False,
                }
        else:
            # 이름 최신화
            supabase.table("users").update({
                "name": meta.get("full_name", existing.data[0].get("name", "")),
            }).eq("id", user_id).execute()
            row = existing.data[0]
            row["has_push"] = bool(row.get("push_subscription"))
            return row

    except Exception as e:
        logger.error(f"유저 처리 오류: {e}")
        raise HTTPException(status_code=500, detail="유저 정보 처리 중 오류가 발생했습니다.")


@app.get("/api/vapid-public-key")
async def get_vapid_public_key():
    """웹 푸시 VAPID 공개키 반환"""
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="VAPID 키 미설정")
    return {"public_key": key}


@app.post("/api/me/push-subscription")
async def save_push_subscription(
    request: Request,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """웹 푸시 구독 정보 저장"""
    try:
        body = await request.json()
        supabase.table("users").update({"push_subscription": body}).eq("id", str(current_user.id)).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"푸시 구독 저장 오류: {e}")
        raise HTTPException(status_code=500, detail="구독 저장 실패")


@app.delete("/api/me/push-subscription")
async def delete_push_subscription(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """웹 푸시 구독 해제"""
    try:
        supabase.table("users").update({"push_subscription": None}).eq("id", str(current_user.id)).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"푸시 구독 해제 오류: {e}")
        raise HTTPException(status_code=500, detail="구독 해제 실패")


@app.delete("/api/me/telegram")
async def unlink_telegram(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """텔레그램 연동 해제"""
    try:
        supabase.table("users").update({"telegram_chat_id": None}).eq("id", str(current_user.id)).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"텔레그램 연동 해제 오류: {e}")
        raise HTTPException(status_code=500, detail="연동 해제 중 오류가 발생했습니다.")


def _calc_weighted_pct(responses_with_users: list, accuracy_map: dict) -> int | None:
    """
    누적 정확도 기반 가중예측치 계산.
    - 정확도 > 50%: 양의 가중치 (예측 그대로 반영)
    - 정확도 = 50%: 가중치 0 (무시)
    - 정확도 < 50%: 음의 가중치 (예측 반전 반영 — 항상 틀리는 사람도 신호가 됨)
    weight = (accuracy - 0.5) * 2  →  범위: -1.0 ~ +1.0
    """
    if not responses_with_users:
        return None

    kospi_score = kospi_w = 0.0

    for r in responses_with_users:
        uid = r["user_id"]
        acc = accuracy_map.get(uid, 0.5)
        weight = (acc - 0.5) * 2  # -1 ~ +1

        if weight == 0.0:
            weight = 1.0

        kospi_vote = 1 if r["kospi_answer"] else -1
        kospi_score += weight * kospi_vote
        kospi_w     += abs(weight)

    return round((kospi_score / kospi_w + 1) / 2 * 100) if kospi_w > 0 else None


def _build_user_accuracy_map(supabase: Client) -> dict:
    """모든 유저의 누적 정확도 딕셔너리 반환 {user_id: accuracy_rate}"""
    all_acc = supabase.table("accuracy_records").select("user_id, kospi_correct").execute()
    user_scores: dict = {}
    for r in all_acc.data:
        uid = r["user_id"]
        if uid not in user_scores:
            user_scores[uid] = {"correct": 0, "total": 0}
        user_scores[uid]["correct"] += 1 if r.get("kospi_correct") else 0
        user_scores[uid]["total"] += 1
    return {
        uid: s["correct"] / s["total"]
        for uid, s in user_scores.items() if s["total"] > 0
    }


@app.get("/api/today")
async def get_today(supabase: Client = Depends(get_supabase)):
    """오늘의 설문 집계 결과 조회 (인증 불필요)"""
    today_str = today_kst()

    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
    if not survey_res.data:
        return {"status": "no_survey", "survey_date": today_str}

    survey = survey_res.data[0]
    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", today_str)
        .execute()
    )
    total = len(responses.data)

    status = "open" if not survey["is_closed"] else ("result" if survey.get("kospi_result") is not None else "closed")

    base = {
        "status": status,
        "survey_date": today_str,
        "total_responses": total,
        "kospi_yes_pct": None,
        "kospi_weighted_pct": None,
        "kospi_result": survey.get("kospi_result"),
        "kospi_change_pct": survey.get("kospi_change_pct"),
    }

    if total > 0:
        kospi_yes = sum(1 for r in responses.data if r["kospi_answer"])
        base["kospi_yes_pct"] = round(kospi_yes / total * 100)

        # 가중예측치 계산
        acc_map = _build_user_accuracy_map(supabase)
        base["kospi_weighted_pct"] = _calc_weighted_pct(responses.data, acc_map)

        # 최고 고수 / 최고 하수 예측 (오늘 응답한 유저 중)
        try:
            resp_map = {r["user_id"]: r for r in responses.data}

            # 예측 횟수 집계 (동률 시 tiebreaker)
            all_acc_rows = supabase.table("accuracy_records").select("user_id").execute()
            pred_count: dict = {}
            for row in all_acc_rows.data:
                pred_count[row["user_id"]] = pred_count.get(row["user_id"], 0) + 1

            candidates = [uid for uid in acc_map if uid in resp_map]
            if not candidates:
                raise ValueError("후보 없음")

            # 정확도 높은 순, 동률이면 예측 횟수 많은 순
            top_uid = max(candidates, key=lambda uid: (acc_map[uid], pred_count.get(uid, 0)))
            # 정확도 낮은 순, 동률이면 예측 횟수 많은 순
            worst_uid = min(candidates, key=lambda uid: (acc_map[uid], -pred_count.get(uid, 0)))

            def _predictor_info(uid):
                user_row = supabase.table("users").select("name").eq("id", uid).execute()
                name = user_row.data[0]["name"] if user_row.data else "익명"
                masked = (name[0] + "**") if name else "익명"
                r = resp_map[uid]
                return {
                    "masked_name": masked,
                    "kospi_answer": r["kospi_answer"],
                    "accuracy": round(acc_map[uid] * 100),
                    "total_predictions": pred_count.get(uid, 0),
                }

            base["top_predictor"] = _predictor_info(top_uid)
            if len(candidates) >= 2 and worst_uid != top_uid:
                base["worst_predictor"] = _predictor_info(worst_uid)
        except Exception as e:
            logger.warning(f"고수/하수 조회 실패: {e}")

    return base


@app.post("/api/survey/respond")
async def web_survey_respond(
    request: Request,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """웹에서 설문 응답 제출"""
    from datetime import datetime, timezone
    import pytz

    user_id = str(current_user.id)
    today_str = today_kst()

    # 설문 존재 여부 확인
    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
    if not survey_res.data:
        raise HTTPException(status_code=400, detail="오늘 설문이 없습니다.")

    survey = survey_res.data[0]
    if survey.get("is_closed"):
        raise HTTPException(status_code=400, detail="설문이 마감됐습니다.")

    body = await request.json()
    kospi_answer = body.get("kospi_answer")

    if kospi_answer is None:
        raise HTTPException(status_code=422, detail="kospi_answer가 필요합니다.")

    supabase.table("survey_responses").upsert({
        "user_id": user_id,
        "survey_date": today_str,
        "kospi_answer": bool(kospi_answer),
        "kosdaq_answer": False,
    }).execute()

    return {"success": True}


@app.get("/api/dashboard")
async def get_dashboard(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """내 예측 이력 + 정확도 + 상위 퍼센트"""
    user_id = str(current_user.id)

    my_responses = (
        supabase.table("survey_responses")
        .select("survey_date, kospi_answer")
        .eq("user_id", user_id)
        .order("survey_date", desc=True)
        .limit(30)
        .execute()
    )

    my_accuracy_res = (
        supabase.table("accuracy_records")
        .select("survey_date, kospi_correct")
        .eq("user_id", user_id)
        .execute()
    )

    accuracy_map = {r["survey_date"]: r for r in my_accuracy_res.data}

    history = []
    for resp in my_responses.data:
        d = resp["survey_date"]
        acc = accuracy_map.get(d, {})
        history.append({
            "date": d,
            "kospi_answer": resp["kospi_answer"],
            "kospi_correct": acc.get("kospi_correct"),
        })

    total_with_result = sum(1 for h in history if h["kospi_correct"] is not None)

    if total_with_result == 0:
        return {
            "accuracy": {"kospi": None, "overall": None},
            "percentile": None,
            "history": history,
            "total_predictions": len(my_responses.data),
        }

    kospi_correct_cnt = sum(1 for h in history if h["kospi_correct"])
    kospi_acc = round(kospi_correct_cnt / total_with_result * 100)

    # 상위 퍼센트 계산
    all_acc = supabase.table("accuracy_records").select("user_id, kospi_correct").execute()
    user_scores: dict = {}
    for r in all_acc.data:
        uid = r["user_id"]
        if uid not in user_scores:
            user_scores[uid] = {"correct": 0, "total": 0}
        user_scores[uid]["correct"] += 1 if r.get("kospi_correct") else 0
        user_scores[uid]["total"] += 1

    my_rate = kospi_correct_cnt / total_with_result
    users_with_lower = sum(
        1 for uid, s in user_scores.items()
        if s["total"] > 0 and s["correct"] / s["total"] < my_rate
    )
    total_users = len(user_scores)
    top_pct = round((1 - users_with_lower / total_users) * 100) if total_users > 1 else 100

    all_rates = [s["correct"] / s["total"] for s in user_scores.values() if s["total"] > 0]
    avg_rate = sum(all_rates) / len(all_rates) if all_rates else 0.5
    contribution = round(my_rate / avg_rate * 100) if avg_rate > 0 else 100

    return {
        "accuracy": {"kospi": kospi_acc, "overall": kospi_acc},
        "percentile": top_pct,
        "contribution": contribution,
        "history": history,
        "total_predictions": len(my_responses.data),
    }


# ─────────────────────────────────────────────────────────────
# 텔레그램 웹훅
# ─────────────────────────────────────────────────────────────

@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    supabase: Client = Depends(get_supabase),
):
    try:
        update = await request.json()
        logger.info(f"웹훅 수신: {update}")
        await handle_webhook(update, supabase)
    except Exception as e:
        logger.error(f"웹훅 처리 오류: {e}", exc_info=True)
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# 관리자 수동 트리거 (테스트용)
# ─────────────────────────────────────────────────────────────

@app.post("/api/admin/trigger-survey")
async def trigger_survey():
    await job_08_50()
    return {"success": True, "message": "설문 발송 완료"}


@app.post("/api/admin/trigger-close")
async def trigger_close():
    await job_09_00()
    return {"success": True, "message": "설문 마감 완료"}


@app.post("/api/admin/trigger-results")
async def trigger_results():
    await job_15_35()
    return {"success": True, "message": "정확도 계산 완료"}


@app.post("/api/admin/test-webpush")
async def test_webpush(
    supabase: Client = Depends(get_supabase),
):
    """웹 푸시 테스트 발송 (구독자 전원)"""
    from datetime import datetime
    now = datetime.now().strftime("%H:%M")
    sent = await send_web_push_to_all(
        supabase,
        title="📊 테스트 알림",
        body=f"웹 푸시 정상 작동 중! ({now})",
        url="/survey",
    )
    return {"success": True, "sent": sent}


@app.get("/api/admin/vapid-debug")
async def vapid_debug():
    """VAPID 키 상태 확인"""
    from webpush_helper import VAPID_PRIVATE_KEY, _load_vapid_private_key
    raw = os.getenv("VAPID_PRIVATE_KEY", "")
    loaded = VAPID_PRIVATE_KEY
    return {
        "raw_length": len(raw),
        "raw_starts_with": raw[:20] if raw else "",
        "loaded_length": len(loaded),
        "loaded_starts_with": loaded[:30] if loaded else "",
        "is_pem": loaded.startswith("-----"),
    }


@app.get("/api/admin/push-subscribers")
async def list_push_subscribers(
    supabase: Client = Depends(get_supabase),
):
    """웹 푸시 구독자 목록 확인"""
    rows = supabase.table("users").select("id,name,push_subscription").execute()
    result = [
        {"id": r["id"], "name": r["name"], "has_push": bool(r.get("push_subscription"))}
        for r in rows.data
    ]
    return {"total": len(result), "users": result}


@app.post("/api/admin/inject-result")
async def inject_result(
    kospi_up: bool,
    kospi_pct: float,
):
    """휴장일 테스트용: 가짜 장 결과를 직접 입력하고 정확도 계산"""
    sb = _supabase_direct()
    today_str = today_kst()

    sb.table("daily_surveys").update({
        "kospi_result": kospi_up,
        "kospi_change_pct": kospi_pct,
    }).eq("survey_date", today_str).execute()

    responses = sb.table("survey_responses").select("user_id, kospi_answer").eq("survey_date", today_str).execute()
    for resp in responses.data:
        sb.table("accuracy_records").upsert({
            "user_id": resp["user_id"],
            "survey_date": today_str,
            "kospi_correct": resp["kospi_answer"] == kospi_up,
        }).execute()

    await send_accuracy_notifications(sb, today_str, kospi_up, kospi_pct)
    return {"success": True, "message": f"결과 입력 완료: 코스피{'▲' if kospi_up else '▼'}{kospi_pct}%"}
