# -*- coding: utf-8 -*-
import os
import logging
from datetime import date, timedelta
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

async def job_08_50():
    """매일 08:48 - 설문 생성 및 텔레그램 발송"""
    sb = _supabase_direct()
    today_str = date.today().isoformat()

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
        url="/dashboard",
    )


async def job_09_00():
    """매일 09:00 - 설문 마감 및 집계 결과 발표"""
    sb = _supabase_direct()
    today_str = date.today().isoformat()

    sb.table("daily_surveys").update({"is_closed": True}).eq("survey_date", today_str).execute()
    logger.info(f"설문 마감: {today_str}")

    await announce_results(sb, today_str)


async def job_15_35():
    """매일 15:35 - 종가 조회 → 정확도 계산 → 개인별 알림"""
    sb = _supabase_direct()
    today_str = date.today().isoformat()

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
        q_hist = yf.Ticker("^KQ11").history(start=today_str, end=tomorrow)

        if k_hist.empty or q_hist.empty:
            logger.warning("yfinance 데이터 없음 - 장이 없는 날(휴장)일 수 있음")
            return

        kospi_open  = float(k_hist["Open"].iloc[-1])
        kospi_close = float(k_hist["Close"].iloc[-1])
        kospi_up    = kospi_close > kospi_open
        kospi_pct   = round((kospi_close / kospi_open - 1) * 100, 2)

        kosdaq_open  = float(q_hist["Open"].iloc[-1])
        kosdaq_close = float(q_hist["Close"].iloc[-1])
        kosdaq_up    = kosdaq_close > kosdaq_open
        kosdaq_pct   = round((kosdaq_close / kosdaq_open - 1) * 100, 2)

        logger.info(f"코스피 {'▲' if kospi_up else '▼'}{kospi_pct}%  코스닥 {'▲' if kosdaq_up else '▼'}{kosdaq_pct}%")

    except Exception as e:
        logger.error(f"yfinance 조회 오류: {e}")
        return

    # DB에 실제 결과 저장
    sb.table("daily_surveys").update({
        "kospi_result": kospi_up,
        "kosdaq_result": kosdaq_up,
        "kospi_change_pct": kospi_pct,
        "kosdaq_change_pct": kosdaq_pct,
    }).eq("survey_date", today_str).execute()

    # 응답자별 정확도 계산
    responses = sb.table("survey_responses").select("user_id, kospi_answer, kosdaq_answer").eq("survey_date", today_str).execute()
    for resp in responses.data:
        sb.table("accuracy_records").upsert({
            "user_id": resp["user_id"],
            "survey_date": today_str,
            "kospi_correct": resp["kospi_answer"] == kospi_up,
            "kosdaq_correct": resp["kosdaq_answer"] == kosdaq_up,
        }).execute()

    # 개인별 텔레그램 알림
    await send_accuracy_notifications(sb, today_str, kospi_up, kospi_pct, kosdaq_up, kosdaq_pct)


# ─────────────────────────────────────────────────────────────
# FastAPI 앱
# ─────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@asynccontextmanager
async def lifespan(app_instance):
    scheduler.add_job(job_08_50, CronTrigger(hour=8,  minute=48, timezone="Asia/Seoul"), id="survey_open",   replace_existing=True)
    scheduler.add_job(job_09_00, CronTrigger(hour=9,  minute=0,  timezone="Asia/Seoul"), id="survey_close",  replace_existing=True)
    scheduler.add_job(job_15_35, CronTrigger(hour=15, minute=35, timezone="Asia/Seoul"), id="market_result", replace_existing=True)
    scheduler.start()
    logger.info("스케줄러 시작: 08:48(설문 발송) / 09:00(마감+발표) / 15:35(정확도 알림)")
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


def _calc_weighted_pct(responses_with_users: list, accuracy_map: dict) -> tuple[int | None, int | None]:
    """
    누적 정확도 기반 가중예측치 계산.
    - 정확도 > 50%: 양의 가중치 (예측 그대로 반영)
    - 정확도 = 50%: 가중치 0 (무시)
    - 정확도 < 50%: 음의 가중치 (예측 반전 반영 — 항상 틀리는 사람도 신호가 됨)
    weight = (accuracy - 0.5) * 2  →  범위: -1.0 ~ +1.0
    """
    if not responses_with_users:
        return None, None

    kospi_score = kospi_w = 0.0
    kosdaq_score = kosdaq_w = 0.0

    for r in responses_with_users:
        uid = r["user_id"]
        acc = accuracy_map.get(uid, 0.5)
        weight = (acc - 0.5) * 2  # -1 ~ +1

        if abs(weight) < 0.05:  # 거의 50%에 가까운 유저는 노이즈로 제외
            continue

        kospi_vote  = 1 if r["kospi_answer"]  else -1
        kosdaq_vote = 1 if r["kosdaq_answer"] else -1

        kospi_score  += weight * kospi_vote
        kospi_w      += abs(weight)
        kosdaq_score += weight * kosdaq_vote
        kosdaq_w     += abs(weight)

    kospi_wpct  = round((kospi_score  / kospi_w  + 1) / 2 * 100) if kospi_w  > 0 else None
    kosdaq_wpct = round((kosdaq_score / kosdaq_w + 1) / 2 * 100) if kosdaq_w > 0 else None
    return kospi_wpct, kosdaq_wpct


def _build_user_accuracy_map(supabase: Client) -> dict:
    """모든 유저의 누적 정확도 딕셔너리 반환 {user_id: accuracy_rate}"""
    all_acc = supabase.table("accuracy_records").select("user_id, kospi_correct, kosdaq_correct").execute()
    user_scores: dict = {}
    for r in all_acc.data:
        uid = r["user_id"]
        if uid not in user_scores:
            user_scores[uid] = {"correct": 0, "total": 0}
        user_scores[uid]["correct"] += (1 if r.get("kospi_correct") else 0) + (1 if r.get("kosdaq_correct") else 0)
        user_scores[uid]["total"] += 2
    return {
        uid: s["correct"] / s["total"]
        for uid, s in user_scores.items() if s["total"] > 0
    }


@app.get("/api/today")
async def get_today(supabase: Client = Depends(get_supabase)):
    """오늘의 설문 집계 결과 조회 (인증 불필요)"""
    today_str = date.today().isoformat()

    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
    if not survey_res.data:
        return {"status": "no_survey", "survey_date": today_str}

    survey = survey_res.data[0]
    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer, kosdaq_answer")
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
        "kosdaq_yes_pct": None,
        "kospi_weighted_pct": None,
        "kosdaq_weighted_pct": None,
        "kospi_result": survey.get("kospi_result"),
        "kosdaq_result": survey.get("kosdaq_result"),
        "kospi_change_pct": survey.get("kospi_change_pct"),
        "kosdaq_change_pct": survey.get("kosdaq_change_pct"),
    }

    if total > 0:
        kospi_yes  = sum(1 for r in responses.data if r["kospi_answer"])
        kosdaq_yes = sum(1 for r in responses.data if r["kosdaq_answer"])
        base["kospi_yes_pct"]  = round(kospi_yes  / total * 100)
        base["kosdaq_yes_pct"] = round(kosdaq_yes / total * 100)

        # 가중예측치 계산
        acc_map = _build_user_accuracy_map(supabase)
        base["kospi_weighted_pct"], base["kosdaq_weighted_pct"] = _calc_weighted_pct(responses.data, acc_map)

    return base


@app.get("/api/dashboard")
async def get_dashboard(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """내 예측 이력 + 정확도 + 상위 퍼센트"""
    user_id = str(current_user.id)

    my_responses = (
        supabase.table("survey_responses")
        .select("survey_date, kospi_answer, kosdaq_answer")
        .eq("user_id", user_id)
        .order("survey_date", desc=True)
        .limit(30)
        .execute()
    )

    my_accuracy_res = (
        supabase.table("accuracy_records")
        .select("survey_date, kospi_correct, kosdaq_correct")
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
            "kosdaq_answer": resp["kosdaq_answer"],
            "kospi_correct": acc.get("kospi_correct"),
            "kosdaq_correct": acc.get("kosdaq_correct"),
        })

    total_with_result = sum(1 for h in history if h["kospi_correct"] is not None)

    if total_with_result == 0:
        return {
            "accuracy": {"kospi": None, "kosdaq": None, "overall": None},
            "percentile": None,
            "history": history,
            "total_predictions": len(my_responses.data),
        }

    kospi_correct_cnt  = sum(1 for h in history if h["kospi_correct"])
    kosdaq_correct_cnt = sum(1 for h in history if h["kosdaq_correct"])

    kospi_acc   = round(kospi_correct_cnt  / total_with_result * 100)
    kosdaq_acc  = round(kosdaq_correct_cnt / total_with_result * 100)
    overall_acc = round((kospi_correct_cnt + kosdaq_correct_cnt) / (total_with_result * 2) * 100)

    # 상위 퍼센트 계산
    all_acc = supabase.table("accuracy_records").select("user_id, kospi_correct, kosdaq_correct").execute()
    user_scores: dict = {}
    for r in all_acc.data:
        uid = r["user_id"]
        if uid not in user_scores:
            user_scores[uid] = {"correct": 0, "total": 0}
        user_scores[uid]["correct"] += (1 if r.get("kospi_correct") else 0) + (1 if r.get("kosdaq_correct") else 0)
        user_scores[uid]["total"] += 2

    my_rate = (kospi_correct_cnt + kosdaq_correct_cnt) / (total_with_result * 2)
    users_with_lower = sum(
        1 for uid, s in user_scores.items()
        if s["total"] > 0 and s["correct"] / s["total"] < my_rate
    )
    total_users = len(user_scores)
    top_pct = round((1 - users_with_lower / total_users) * 100) if total_users > 1 else 100

    # 내 가중치 기여도: 내 정확도 / 전체 평균 정확도 (1.0이면 평균, >1이면 평균 이상)
    all_rates = [s["correct"] / s["total"] for s in user_scores.values() if s["total"] > 0]
    avg_rate = sum(all_rates) / len(all_rates) if all_rates else 0.5
    contribution = round(my_rate / avg_rate * 100) if avg_rate > 0 else 100

    return {
        "accuracy": {"kospi": kospi_acc, "kosdaq": kosdaq_acc, "overall": overall_acc},
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
        url="/dashboard",
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
    kosdaq_up: bool,
    kosdaq_pct: float,
):
    """휴장일 테스트용: 가짜 장 결과를 직접 입력하고 정확도 계산"""
    sb = _supabase_direct()
    today_str = date.today().isoformat()

    sb.table("daily_surveys").update({
        "kospi_result": kospi_up,
        "kosdaq_result": kosdaq_up,
        "kospi_change_pct": kospi_pct,
        "kosdaq_change_pct": kosdaq_pct,
    }).eq("survey_date", today_str).execute()

    responses = sb.table("survey_responses").select("user_id, kospi_answer, kosdaq_answer").eq("survey_date", today_str).execute()
    for resp in responses.data:
        sb.table("accuracy_records").upsert({
            "user_id": resp["user_id"],
            "survey_date": today_str,
            "kospi_correct": resp["kospi_answer"] == kospi_up,
            "kosdaq_correct": resp["kosdaq_answer"] == kosdaq_up,
        }).execute()

    await send_accuracy_notifications(sb, today_str, kospi_up, kospi_pct, kosdaq_up, kosdaq_pct)
    return {"success": True, "message": f"결과 입력 완료: 코스피{'▲' if kospi_up else '▼'}{kospi_pct}% 코스닥{'▲' if kosdaq_up else '▼'}{kosdaq_pct}%"}
