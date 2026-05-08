# -*- coding: utf-8 -*-
import os
import asyncio
import time
import logging
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

def today_kst() -> str:
    """KST 기준 오늘 날짜 (Railway는 UTC이므로 명시적으로 변환)"""
    return datetime.now(KST).date().isoformat()

def next_trading_day_str() -> str:
    """KST 기준 다음 거래일 (주말 건너뜀)"""
    d = datetime.now(KST).date() + timedelta(days=1)
    while d.weekday() >= 5:  # 5=토, 6=일
        d += timedelta(days=1)
    return d.isoformat()
from contextlib import asynccontextmanager

import yfinance as yf
import pytz
from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
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
    notify_challenge_results,
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

async def job_22_00():
    """매일 22:00 - 다음 거래일 코스피 예측 설문 텔레그램+웹푸시 발송"""
    sb = _supabase_direct()
    next_str = next_trading_day_str()

    # 다음 거래일 설문이 없으면 생성
    existing = sb.table("daily_surveys").select("id").eq("survey_date", next_str).execute()
    if not existing.data:
        sb.table("daily_surveys").insert({"survey_date": next_str}).execute()
        logger.info(f"22:00 다음 거래일 설문 생성: {next_str}")

    await send_daily_survey_to_all(sb, next_str, is_reminder=False)
    await send_web_push_to_all(
        sb,
        title="📊 내일 코스피, 함께 맞춰요!",
        body=f"내일 장 예측 설문이 열렸어요. 지금 바로 참여하세요 👆 (마감 09:00)",
        url="/survey",
    )
    logger.info("22:00 설문 발송 완료")


async def job_08_45():
    """매일 08:45 - 텔레그램 + 웹푸시 마감임박 알림"""
    sb = _supabase_direct()
    today_str = today_kst()

    # 혹시 설문이 없으면 폴백으로 생성
    existing = sb.table("daily_surveys").select("id").eq("survey_date", today_str).execute()
    if not existing.data:
        sb.table("daily_surveys").insert({"survey_date": today_str}).execute()
        logger.info(f"08:45 폴백 설문 생성: {today_str}")
        await send_daily_survey_to_all(sb, today_str, is_reminder=False)
    else:
        await send_daily_survey_to_all(sb, today_str, is_reminder=True)

    await send_web_push_to_all(
        sb,
        title="⏰ 마감 임박! 09:00까지예요",
        body="아직 코스피 예측 안 하셨나요? 지금 바로 참여하세요 📊",
        url="/survey",
    )
    logger.info("08:45 마감임박 텔레그램+웹푸시 발송 완료")


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

    # KOSPI 결과 조회 + 저장: Vercel API 라우트에 위임 (Railway IP 우회)
    vercel_url    = os.getenv("VERCEL_APP_URL", "https://kospi-prediction-game.vercel.app")
    admin_secret  = os.getenv("ADMIN_SECRET", "kospi-admin-2026")
    kospi_up = kospi_pct = None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{vercel_url}/api/admin/fetch-kospi-result",
                headers={"x-admin-secret": admin_secret},
            )
            resp.raise_for_status()
            result = resp.json()

        if not result.get("ok"):
            logger.error(f"Vercel fetch-kospi-result 실패: {result}")
            return

        kospi_up  = bool(result["isUp"])
        kospi_pct = float(result["changePct"])
        logger.info(f"Vercel 통해 KOSPI 결과 저장 완료: {'▲' if kospi_up else '▼'}{kospi_pct}%")

    except Exception as e:
        logger.error(f"KOSPI 결과 fetch 오류: {e}")
        return

    # 개인별 텔레그램 알림 (정확도는 Vercel 쪽에서 이미 업데이트됨)
    await send_accuracy_notifications(sb, today_str, kospi_up, kospi_pct)

    # 대결 결과 처리 및 알림
    try:
        await notify_challenge_results(sb, today_str)
    except Exception as e:
        logger.error(f"대결 결과 알림 오류: {e}")

    # 다음 거래일 설문 미리 생성 (장마감 후 바로 예측 참여 가능하도록)
    next_str = next_trading_day_str()
    try:
        existing_next = sb.table("daily_surveys").select("id").eq("survey_date", next_str).execute()
        if not existing_next.data:
            sb.table("daily_surveys").insert({"survey_date": next_str}).execute()
            logger.info(f"다음 거래일 설문 미리 생성: {next_str}")
    except Exception as e:
        logger.warning(f"다음 거래일 설문 생성 실패 (무시): {e}")


# ─────────────────────────────────────────────────────────────
# FastAPI 앱
# ─────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@asynccontextmanager
async def lifespan(app_instance):
    global _kospi_snap_lock
    _kospi_snap_lock = asyncio.Lock()
    scheduler.add_job(job_22_00, CronTrigger(hour=22, minute=0,  timezone="Asia/Seoul"), id="survey_evening",   replace_existing=True)
    scheduler.add_job(job_08_45, CronTrigger(hour=8,  minute=45, timezone="Asia/Seoul"), id="survey_reminder",  replace_existing=True)
    scheduler.add_job(job_09_00, CronTrigger(hour=9,  minute=0,  timezone="Asia/Seoul"), id="survey_close",     replace_existing=True)
    scheduler.add_job(job_15_35, CronTrigger(hour=15, minute=35, timezone="Asia/Seoul"), id="market_result",    replace_existing=True)
    # 장 중 30분마다 KOSPI 가격 스냅샷 (09:00 ~ 15:30)
    scheduler.add_job(
        job_kospi_snapshot,
        CronTrigger(hour="9-15", minute="0,30", timezone="Asia/Seoul"),
        id="kospi_snapshot",
        replace_existing=True,
    )
    # Railway 콜드스타트 방지: 5분마다 자기 자신에게 ping
    scheduler.add_job(
        _self_ping,
        "interval",
        minutes=5,
        id="self_ping",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("스케줄러 시작: 22:00(설문 발송) / 08:45(마감임박) / 09:00(마감) / 15:35(정확도) / 09-15시 30분(KOSPI 스냅샷)")
    yield
    scheduler.shutdown()


app = FastAPI(title="주식 예측 봇 API", version="3.0.0", lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://kospi-prediction-game.vercel.app")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    # Vercel 배포(URL이 프로젝트마다 다름)·프리뷰 도메인 패턴 허용 (HTTPS만)
    allow_origin_regex=r"https://[^\s]+\.vercel\.app",
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


@app.get("/api/health")
async def health():
    return {"ok": True}


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


@app.get("/api/public/history")
async def get_public_history(supabase: Client = Depends(get_supabase)):
    """로그인 화면용 공개 실적 히스토리 (최근 20일, 인증 불필요)"""
    try:
        # 결과가 있는 날만 가져옴 (kospi_result IS NOT NULL)
        rows = (
            supabase.table("daily_surveys")
            .select("survey_date, kospi_result, kospi_change_pct")
            .filter("kospi_result", "not.is", "null")
            .order("survey_date", desc=True)
            .limit(20)
            .execute()
        )
    except Exception as e:
        logger.error(f"public/history 쿼리 오류: {e}")
        return {"history": [], "stats": {"total_days": 0, "majority_accuracy": 0, "weighted_accuracy": 0}}

    if not rows.data:
        return {"history": [], "stats": {"total_days": 0, "majority_accuracy": 0, "weighted_accuracy": 0}}

    # acc_map은 루프 밖에서 한 번만 조회
    try:
        acc_map = _build_user_accuracy_map(supabase)
    except Exception:
        acc_map = {}

    # 해당 날짜 전체 응답을 한 번에 조회
    survey_dates = [row["survey_date"] for row in rows.data]
    try:
        all_resp = (
            supabase.table("survey_responses")
            .select("survey_date, kospi_answer, user_id")
            .in_("survey_date", survey_dates)
            .execute()
        )
    except Exception as e:
        logger.error(f"public/history 응답 쿼리 오류: {e}")
        return {"history": [], "stats": {"total_days": 0, "majority_accuracy": 0, "weighted_accuracy": 0}}

    # 날짜별로 응답 분류
    resp_by_date: dict = {}
    for r in all_resp.data:
        resp_by_date.setdefault(r["survey_date"], []).append(r)

    results = []
    for row in rows.data:
        d = row["survey_date"]
        resp_list = resp_by_date.get(d, [])
        total = len(resp_list)
        if total == 0:
            continue

        yes_cnt = sum(1 for r in resp_list if r["kospi_answer"])
        majority_up = yes_cnt >= total / 2
        actual_up = row["kospi_result"]
        majority_correct = majority_up == actual_up

        weighted_pct = _calc_weighted_pct(resp_list, acc_map)
        weighted_up = weighted_pct >= 50 if weighted_pct is not None else majority_up
        weighted_correct = weighted_up == actual_up

        results.append({
            "date": d,
            "total": total,
            "kospi_yes_pct": round(yes_cnt / total * 100),
            "majority_up": majority_up,
            "weighted_pct": weighted_pct,
            "weighted_up": weighted_up,
            "actual_up": actual_up,
            "change_pct": row.get("kospi_change_pct"),
            "majority_correct": majority_correct,
            "weighted_correct": weighted_correct,
        })

    total_days = len(results)
    majority_hits = sum(1 for r in results if r["majority_correct"])
    weighted_hits = sum(1 for r in results if r["weighted_correct"])

    return {
        "history": results,
        "stats": {
            "total_days": total_days,
            "majority_accuracy": round(majority_hits / total_days * 100) if total_days else 0,
            "weighted_accuracy": round(weighted_hits / total_days * 100) if total_days else 0,
        },
    }


# ── KOSPI 장 중 가격 스냅샷 (30분마다 스케줄러가 채움) ──────
_kospi_snapshots: list = []   # [{"time":"09:00","open":..,"high":..,"low":..,"close":..}, ...]
_kospi_snap_date: str  = ""   # "2026-05-08"
_kospi_snap_lock: asyncio.Lock | None = None  # lifespan에서 초기화


async def _naver_kospi_price() -> float | None:
    """네이버 파이낸스에서 현재 KOSPI 지수 반환 (빠른 API 사용)"""
    url = "https://m.stock.naver.com/api/index/KOSPI/basic"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
            raw = data.get("closePrice", "").replace(",", "")
            return float(raw) if raw else None
    except Exception as e:
        logger.warning(f"네이버 KOSPI 가격 조회 실패: {e}")
        return None


async def _self_ping():
    """Railway 콜드스타트 방지용 자기 ping"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.get("https://kospi-prediction-game-production.up.railway.app/api/health")
    except Exception:
        pass  # 실패해도 무시


async def job_kospi_snapshot():
    """장 중 30분마다 KOSPI 가격 스냅샷 저장"""
    global _kospi_snapshots, _kospi_snap_date
    kst_now = datetime.now(KST)
    today = kst_now.date().isoformat()
    hour_label = kst_now.strftime("%H:00")

    price = await _naver_kospi_price()
    if price is None:
        logger.warning("KOSPI 스냅샷: 가격 조회 실패, 건너뜀")
        return

    lock = _kospi_snap_lock or asyncio.Lock()
    async with lock:
        if today != _kospi_snap_date:
            _kospi_snapshots.clear()
            _kospi_snap_date = today

        existing = next((s for s in _kospi_snapshots if s["time"] == hour_label), None)
        if existing:
            existing["close"] = price
            existing["high"]  = max(existing["high"], price)
            existing["low"]   = min(existing["low"],  price)
        else:
            _kospi_snapshots.append({
                "time":  hour_label,
                "open":  price,
                "high":  price,
                "low":   price,
                "close": price,
            })
    logger.info(f"KOSPI 스냅샷 저장: {hour_label} = {price}")


@app.get("/api/public/kospi-chart")
async def get_kospi_chart():
    """오늘 KOSPI 1시간봉 스냅샷 반환 (장 중 30분마다 업데이트)"""
    lock = _kospi_snap_lock or asyncio.Lock()
    async with lock:
        data = list(_kospi_snapshots)
    return {"data": data}


@app.get("/api/public/kospi-price")
async def get_kospi_price(supabase: Client = Depends(get_supabase)):
    """오늘 KOSPI 종가/OHLC — Naver basic API (Vercel에서 호출 가능)"""
    today_str = today_kst()

    # 1) DB에 오늘 결과가 있으면 Naver OHLC와 합쳐서 반환
    db_pct = db_is_up = None
    try:
        row = supabase.table("daily_surveys") \
            .select("kospi_result,kospi_change_pct") \
            .eq("survey_date", today_str) \
            .maybe_single().execute()
        if row.data and row.data.get("kospi_change_pct") is not None:
            db_is_up = bool(row.data["kospi_result"])
            db_pct   = float(row.data["kospi_change_pct"])
    except Exception:
        pass

    # 2) Naver basic API로 OHLC 조회 (Vercel IP에서도 접근 가능한 경우 사용)
    try:
        url = "https://m.stock.naver.com/api/index/KOSPI/basic"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)"}
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            d = r.json()

        def _num(key: str) -> float | None:
            v = d.get(key, "").replace(",", "")
            return float(v) if v else None

        price      = _num("closePrice")
        open_p     = _num("openPrice")
        high_p     = _num("highPrice")
        low_p      = _num("lowPrice")
        ratio_str  = (d.get("fluctuationsRatio") or "").replace(",", "")
        code       = d.get("compareToPreviousPrice", {}).get("code", "")
        naver_pct  = float(ratio_str) if ratio_str else None
        naver_up   = code == "2"

        return {
            "price":      price,
            "open":       open_p,
            "high":       high_p,
            "low":        low_p,
            "change_pct": db_pct if db_pct is not None else naver_pct,
            "is_up":      db_is_up if db_is_up is not None else naver_up,
            "code":       code,
            "source":     "naver",
        }
    except Exception as e:
        logger.warning(f"Naver KOSPI OHLC 실패: {e}")

    # 3) 모두 실패 시 DB 값만 반환
    if db_pct is not None:
        return {"price": None, "open": None, "high": None, "low": None,
                "change_pct": db_pct, "is_up": db_is_up,
                "code": "2" if db_is_up else "5", "source": "db_only"}
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)", "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            meta = resp.json()["chart"]["result"][0]["meta"]
        price      = float(meta.get("regularMarketPrice") or 0)
        prev_close = float(meta.get("chartPreviousClose") or meta.get("previousClose") or 0)
        change_pct = round((price / prev_close - 1) * 100, 2) if prev_close else None
        is_up      = price > prev_close if prev_close else None
        return {"price": price or None, "open": None, "high": None, "low": None,
                "change_pct": change_pct, "is_up": is_up,
                "code": "2" if is_up else ("5" if is_up is False else ""), "source": "yahoo"}
    except Exception as e:
        logger.error(f"KOSPI 가격 조회 오류: {e}")
        return {"price": None, "open": None, "high": None, "low": None,
                "change_pct": None, "is_up": None, "code": ""}


@app.post("/api/admin/run-15-35")
async def admin_run_15_35():
    """15:35 결과 집계 수동 트리거 (배포 후 테스트용)"""
    await job_15_35()
    return {"ok": True}


@app.post("/api/admin/set-kospi-result")
async def admin_set_kospi_result(
    payload: dict,
    supabase: Client = Depends(get_supabase),
):
    """KOSPI 결과 수동 저장 (Railway IP 우회용)
    Body: { date, changePct, isUp }
    """
    date       = payload.get("date") or today_kst()
    change_pct = float(payload.get("changePct", 0))
    is_up      = bool(payload.get("isUp", True))

    supabase.table("daily_surveys").update({
        "kospi_result":     is_up,
        "kospi_change_pct": change_pct,
        "is_closed":        True,
    }).eq("survey_date", date).execute()

    responses = supabase.table("survey_responses") \
        .select("user_id, kospi_answer").eq("survey_date", date).execute()
    for r in responses.data:
        supabase.table("accuracy_records").upsert(
            {"user_id": r["user_id"], "survey_date": date,
             "kospi_correct": r["kospi_answer"] == is_up},
            on_conflict="user_id,survey_date",
        ).execute()

    return {"ok": True, "date": date, "changePct": change_pct, "isUp": is_up,
            "participants": len(responses.data)}


@app.get("/api/public/backtest")
async def get_backtest(supabase: Client = Depends(get_supabase)):
    """백테스트: 고수 강화예측 따라 KOSPI 추종 매매 수익률 (DB 데이터만 사용, 외부 API 없음)"""
    try:
        # 결과 있는 최근 30일 조회 (kospi_change_pct 포함)
        rows = (
            supabase.table("daily_surveys")
            .select("survey_date, kospi_result, kospi_change_pct")
            .filter("kospi_result", "not.is", "null")
            .filter("kospi_change_pct", "not.is", "null")
            .order("survey_date", desc=False)
            .limit(30)
            .execute()
        )
        if not rows.data or len(rows.data) < 2:
            return {"results": {}, "total_days": 0}

        survey_dates = [r["survey_date"] for r in rows.data]

        # 날짜별 응답 조회
        all_resp = (
            supabase.table("survey_responses")
            .select("survey_date, kospi_answer, user_id")
            .in_("survey_date", survey_dates)
            .execute()
        )
        resp_by_date: dict = {}
        for r in all_resp.data:
            resp_by_date.setdefault(r["survey_date"], []).append(r)

        acc_map = _build_user_accuracy_map(supabase)

        # 날짜별 예측 방향 + 실제 수익률 계산
        daily_results = []
        strategy_cum = 1.0
        hold_cum = 1.0

        for row in rows.data:
            d = row["survey_date"]
            change_pct = row.get("kospi_change_pct")
            if change_pct is None:
                continue

            resp_list = resp_by_date.get(d, [])
            if not resp_list:
                continue

            wpct = _calc_weighted_pct(resp_list, acc_map)
            pred_up = (wpct >= 50) if wpct is not None else (
                sum(1 for r in resp_list if r["kospi_answer"]) >= len(resp_list) / 2
            )

            daily_ret = change_pct / 100
            hold_cum *= (1 + daily_ret)
            if pred_up:
                strategy_cum *= (1 + daily_ret)

            daily_results.append({
                "date": d,
                "pred_up": pred_up,
                "daily_return": round(change_pct, 2),
                "strategy_cum": round((strategy_cum - 1) * 100, 2),
            })

        if len(daily_results) < 2:
            return {"results": {}, "total_days": 0}

        strategy_return = round((strategy_cum - 1) * 100, 2)
        hold_return = round((hold_cum - 1) * 100, 2)

        results = {
            "KOSPI 추종": {
                "strategy_return": strategy_return,
                "hold_return": hold_return,
                "days": len(daily_results),
                "recent": daily_results[-7:],
            }
        }

        return {"results": results, "total_days": len(daily_results)}

    except Exception as e:
        logger.error(f"백테스트 오류: {e}")
        return {"results": {}, "total_days": 0}


@app.get("/api/today")
async def get_today(supabase: Client = Depends(get_supabase)):
    """오늘의 설문 집계 결과 조회 (인증 불필요)"""
    today_str = today_kst()

    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
    if not survey_res.data:
        # 평일 00:00~09:00 사이에 레코드가 없으면 자동 생성 (22:00 job이 누락된 경우 대비)
        now_kst = datetime.now(KST)
        if now_kst.weekday() < 5 and now_kst.hour < 9:
            try:
                supabase.table("daily_surveys").upsert(
                    {"survey_date": today_str, "is_closed": False},
                    on_conflict="survey_date"
                ).execute()
                logger.info(f"get_today: {today_str} 설문 레코드 자동 생성 (early morning fallback)")
                survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
            except Exception as e:
                logger.error(f"get_today fallback 생성 오류: {e}")
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

    if survey.get("kospi_result") is not None:
        status = "result"
    elif survey["is_closed"]:
        status = "closed"
    else:
        status = "open"

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
                    "user_id": uid,
                    "masked_name": masked,
                    "kospi_answer": r["kospi_answer"],
                    "accuracy": round(acc_map[uid] * 100),
                    "total_predictions": pred_count.get(uid, 0),
                }

            base["top_predictor"] = _predictor_info(top_uid)
            if len(candidates) >= 2 and worst_uid != top_uid:
                base["worst_predictor"] = _predictor_info(worst_uid)

            # 전체 참여자 목록 (정확도 순 정렬)
            participants = []
            for uid in candidates:
                info = _predictor_info(uid)
                participants.append(info)
            participants.sort(key=lambda x: -x["accuracy"])
            base["participants"] = participants

        except Exception as e:
            logger.warning(f"고수/하수 조회 실패: {e}")

        # acc_map에 없는 참여자 (신규, 정확도 기록 없음)도 추가
        if "participants" not in base:
            base["participants"] = []
        known_uids = {p.get("user_id") for p in base["participants"]} if base["participants"] else set()
        for r in responses.data:
            uid = r["user_id"]
            if uid not in known_uids and uid not in acc_map:
                try:
                    user_row = supabase.table("users").select("name").eq("id", uid).execute()
                    name = user_row.data[0]["name"] if user_row.data else "익명"
                    masked = (name[0] + "**") if name else "익명"
                    base["participants"].append({
                        "user_id": uid,
                        "masked_name": masked,
                        "kospi_answer": r["kospi_answer"],
                        "accuracy": None,
                        "total_predictions": 0,
                    })
                except Exception:
                    pass

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

    # users 테이블에 유저가 없으면 자동 생성 (FK 오류 방지)
    try:
        existing_user = supabase.table("users").select("id").eq("id", user_id).execute()
        if not existing_user.data:
            meta = current_user.user_metadata or {}
            supabase.table("users").insert({
                "id": user_id,
                "email": current_user.email,
                "name": meta.get("full_name", meta.get("name", "")),
            }).execute()
            logger.info(f"survey/respond: 신규 유저 자동 생성 {user_id}")
    except Exception as e:
        logger.warning(f"survey/respond: 유저 생성 시도 중 오류 (무시): {e}")

    body = await request.json()
    kospi_answer = body.get("kospi_answer")
    # 클라이언트가 survey_date를 명시하면 그걸 사용, 없으면 오늘
    target_date = body.get("survey_date") or today_str

    if kospi_answer is None:
        raise HTTPException(status_code=422, detail="kospi_answer가 필요합니다.")

    # 해당 날짜 설문 존재 여부 + 마감 여부 확인
    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", target_date).execute()
    if not survey_res.data:
        raise HTTPException(status_code=400, detail="해당 날짜의 설문이 없습니다.")
    survey = survey_res.data[0]
    if survey.get("is_closed"):
        raise HTTPException(status_code=400, detail="설문이 마감됐습니다.")

    try:
        supabase.table("survey_responses").upsert(
            {
                "user_id": user_id,
                "survey_date": target_date,
                "kospi_answer": bool(kospi_answer),
                "kosdaq_answer": False,
            },
            on_conflict="user_id,survey_date",
        ).execute()
    except Exception as e:
        logger.exception("survey_responses upsert 오류")
        raise HTTPException(status_code=500, detail=f"응답 저장 중 오류: {e}")

    return {"success": True, "survey_date": target_date}


@app.get("/api/survey/my-response")
async def get_my_response(
    survey_date: str = None,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """특정 날짜(기본=오늘) 내 응답 조회"""
    user_id = str(current_user.id)
    target_date = survey_date or today_kst()
    res = supabase.table("survey_responses") \
        .select("kospi_answer") \
        .eq("user_id", user_id) \
        .eq("survey_date", target_date) \
        .execute()
    if res.data:
        return {"answered": True, "kospi_answer": res.data[0]["kospi_answer"]}
    return {"answered": False, "kospi_answer": None}


@app.get("/api/next-survey")
async def get_next_survey(supabase: Client = Depends(get_supabase)):
    """다음 거래일 설문 상태 반환 (장마감 후 미리 예측 참여용)"""
    next_str = next_trading_day_str()
    res = supabase.table("daily_surveys").select("survey_date, is_closed").eq("survey_date", next_str).execute()
    if res.data and not res.data[0]["is_closed"]:
        return {"survey_date": next_str, "is_open": True}
    return {"survey_date": next_str, "is_open": False}


# ─────────────────────────────────────────────────────────────────────────────
# 대결 (Challenges) 엔드포인트
# ─────────────────────────────────────────────────────────────────────────────

class ChallengeRequest(BaseModel):
    challenged_user_id: str
    survey_date: str

@app.post("/api/challenges")
async def create_challenge(
    body: ChallengeRequest,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """대결 신청"""
    from telegram_bot import send_message as tg_send
    challenger_id = str(current_user.id)
    challenged_id = body.challenged_user_id
    date_str = body.survey_date

    if challenger_id == challenged_id:
        raise HTTPException(400, "자신에게 대결을 신청할 수 없어요")

    existing = (
        supabase.table("challenges")
        .select("id")
        .eq("challenger_id", challenger_id)
        .eq("challenged_id", challenged_id)
        .eq("survey_date", date_str)
        .execute()
    )
    if existing.data:
        raise HTTPException(400, "이미 대결을 신청했어요")

    result = (
        supabase.table("challenges")
        .insert({"challenger_id": challenger_id, "challenged_id": challenged_id, "survey_date": date_str, "outcome": "pending"})
        .execute()
    )

    challenger_row = supabase.table("users").select("name").eq("id", challenger_id).execute()
    c_name = challenger_row.data[0]["name"] if challenger_row.data else "익명"
    c_masked = (c_name[0] + "**") if c_name else "익명"

    challenged_row = supabase.table("users").select("telegram_chat_id").eq("id", challenged_id).execute()
    if challenged_row.data and challenged_row.data[0].get("telegram_chat_id"):
        try:
            await tg_send(
                challenged_row.data[0]["telegram_chat_id"],
                f"⚔️ <b>대결 신청!</b>\n\n"
                f"<b>{c_masked}</b>님이 {date_str} 예측 대결을 신청했어요!\n\n"
                f"장 마감 후 결과를 함께 확인해봐요 🔥",
            )
        except Exception as e:
            logger.warning(f"대결 신청 텔레그램 알림 실패: {e}")

    # 웹 푸시 알림도 함께 발송
    from webpush_helper import send_web_push_to_user
    send_web_push_to_user(
        supabase, challenged_id,
        title="⚔️ 대결 신청이 왔어요!",
        body=f"{c_masked}님이 오늘 예측 대결을 신청했어요. 장 마감 후 결과를 확인해보세요!",
        url="/dashboard",
    )

    return {"ok": True, "challenge_id": result.data[0]["id"] if result.data else None}


@app.get("/api/challenges/me")
async def get_my_challenges(
    date: str = None,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """내가 보내거나 받은 오늘의 대결 목록"""
    user_id = str(current_user.id)
    date_str = date or today_kst()

    sent_res = (
        supabase.table("challenges").select("*")
        .eq("challenger_id", user_id).eq("survey_date", date_str).execute()
    )
    recv_res = (
        supabase.table("challenges").select("*")
        .eq("challenged_id", user_id).eq("survey_date", date_str).execute()
    )

    def _masked(uid: str) -> str:
        row = supabase.table("users").select("name").eq("id", uid).execute()
        name = row.data[0]["name"] if row.data else "익명"
        return (name[0] + "**") if name else "익명"

    def _enrich(c, is_sent: bool):
        other = c["challenged_id"] if is_sent else c["challenger_id"]
        my_reaction    = c.get("challenger_reaction") if is_sent else c.get("challenged_reaction")
        opp_reaction   = c.get("challenged_reaction") if is_sent else c.get("challenger_reaction")
        return {
            "id": c["id"],
            "opponent_masked_name": _masked(other),
            "opponent_id": other,
            "outcome": c["outcome"],
            "survey_date": c["survey_date"],
            "is_sent": is_sent,
            "my_reaction": my_reaction,
            "opp_reaction": opp_reaction,
        }

    return {
        "sent":     [_enrich(c, True)  for c in sent_res.data],
        "received": [_enrich(c, False) for c in recv_res.data],
    }


class ReactRequest(BaseModel):
    reaction: str  # "😄" | "😢" | "😝"

ALLOWED_REACTIONS = {"😄", "😢", "😝"}

@app.post("/api/challenges/{challenge_id}/react")
async def react_to_challenge(
    challenge_id: str,
    body: ReactRequest,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """결과 확정 후 상대방에게 이모티콘 반응 전송"""
    from telegram_bot import send_message as tg_send
    from webpush_helper import send_web_push_to_user

    if body.reaction not in ALLOWED_REACTIONS:
        raise HTTPException(400, "허용되지 않는 반응이에요")

    user_id = str(current_user.id)
    ch_res = supabase.table("challenges").select("*").eq("id", challenge_id).execute()
    if not ch_res.data:
        raise HTTPException(404, "대결을 찾을 수 없어요")

    ch = ch_res.data[0]
    if ch["outcome"] == "pending":
        raise HTTPException(400, "결과가 아직 나오지 않았어요")

    is_challenger = ch["challenger_id"] == user_id
    is_challenged = ch["challenged_id"] == user_id
    if not is_challenger and not is_challenged:
        raise HTTPException(403, "내 대결이 아니에요")

    reaction_col = "challenger_reaction" if is_challenger else "challenged_reaction"
    opponent_id  = ch["challenged_id"] if is_challenger else ch["challenger_id"]

    supabase.table("challenges").update({reaction_col: body.reaction}).eq("id", challenge_id).execute()

    # 내 이름 마스킹
    my_row = supabase.table("users").select("name").eq("id", user_id).execute()
    my_name = my_row.data[0]["name"] if my_row.data else "익명"
    my_masked = (my_name[0] + "**") if my_name else "익명"

    tg_text = f"{body.reaction} <b>{my_masked}</b>님이 반응을 보냈어요!\n앱에서 확인해보세요 👀"
    push_body = f"{my_masked}님이 {body.reaction} 반응을 보냈어요!"

    opp_row = supabase.table("users").select("telegram_chat_id").eq("id", opponent_id).execute()
    if opp_row.data and opp_row.data[0].get("telegram_chat_id"):
        try:
            await tg_send(opp_row.data[0]["telegram_chat_id"], tg_text)
        except Exception as e:
            logger.warning(f"반응 텔레그램 알림 실패: {e}")

    send_web_push_to_user(supabase, opponent_id, "⚔️ 상대방이 반응했어요!", push_body, "/dashboard")

    return {"ok": True}


@app.post("/api/challenges/{challenge_id}/rematch")
async def request_rematch(
    challenge_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """결과 확정 후 다음 거래일 재대결 신청"""
    from telegram_bot import send_message as tg_send
    from webpush_helper import send_web_push_to_user

    user_id = str(current_user.id)
    ch_res = supabase.table("challenges").select("*").eq("id", challenge_id).execute()
    if not ch_res.data:
        raise HTTPException(404, "대결을 찾을 수 없어요")

    ch = ch_res.data[0]
    if ch["outcome"] == "pending":
        raise HTTPException(400, "결과가 아직 나오지 않았어요")

    is_challenger = ch["challenger_id"] == user_id
    is_challenged = ch["challenged_id"] == user_id
    if not is_challenger and not is_challenged:
        raise HTTPException(403, "내 대결이 아니에요")

    opponent_id = ch["challenged_id"] if is_challenger else ch["challenger_id"]
    next_str = next_trading_day_str()

    # 이미 재대결 신청 여부 확인
    existing = (
        supabase.table("challenges").select("id")
        .eq("challenger_id", user_id).eq("challenged_id", opponent_id).eq("survey_date", next_str).execute()
    )
    if existing.data:
        raise HTTPException(400, "이미 재대결을 신청했어요")

    result = supabase.table("challenges").insert({
        "challenger_id": user_id,
        "challenged_id": opponent_id,
        "survey_date": next_str,
        "outcome": "pending",
    }).execute()

    my_row = supabase.table("users").select("name").eq("id", user_id).execute()
    my_name = my_row.data[0]["name"] if my_row.data else "익명"
    my_masked = (my_name[0] + "**") if my_name else "익명"

    tg_text = (
        f"🔥 <b>재대결 신청!</b>\n\n"
        f"<b>{my_masked}</b>님이 {next_str} 재대결을 신청했어요!\n"
        f"내일도 예측 대결, 받아주실 건가요? 😤"
    )
    push_body = f"{my_masked}님이 내일 재대결을 신청했어요! 😤"

    opp_row = supabase.table("users").select("telegram_chat_id").eq("id", opponent_id).execute()
    if opp_row.data and opp_row.data[0].get("telegram_chat_id"):
        try:
            await tg_send(opp_row.data[0]["telegram_chat_id"], tg_text)
        except Exception as e:
            logger.warning(f"재대결 텔레그램 알림 실패: {e}")

    send_web_push_to_user(supabase, opponent_id, "🔥 재대결 신청이 왔어요!", push_body, "/dashboard")

    return {"ok": True, "challenge_id": result.data[0]["id"] if result.data else None, "survey_date": next_str}


# ─────────────────────────────────────────────────────────────────────────────

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
            "contribution": None,
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


@app.post("/api/admin/reopen-survey")
async def admin_reopen_survey():
    """테스트용: 오늘 설문 마감 해제 (09:00 이후에도 다시 응답 가능)"""
    sb = _supabase_direct()
    d = today_kst()
    sb.table("daily_surveys").update({"is_closed": False}).eq("survey_date", d).execute()
    return {"success": True, "survey_date": d}


@app.post("/api/admin/resend-telegram-survey")
async def admin_resend_telegram_survey():
    """테스트용: 오늘 날짜로 텔레그램 설문 메시지 재발송 (행은 이미 있어야 함)"""
    sb = _supabase_direct()
    d = today_kst()
    row = sb.table("daily_surveys").select("id").eq("survey_date", d).execute()
    if not row.data:
        raise HTTPException(status_code=400, detail="오늘 daily_surveys 행이 없습니다.")
    await send_daily_survey_to_all(sb, d)
    return {"success": True, "survey_date": d, "message": "텔레그램 설문 재발송 완료"}


@app.post("/api/admin/trigger-close")
async def trigger_close():
    await job_09_00()
    return {"success": True, "message": "설문 마감 완료"}


@app.post("/api/admin/set-result")
async def set_result_manually(
    kospi_change_pct: float,
    survey_date: str = None,
    supabase: Client = Depends(get_supabase),
):
    """KOSPI 결과를 수동으로 설정 (자동 조회 실패 시 사용)"""
    d = survey_date or today_kst()
    kospi_up = kospi_change_pct > 0
    supabase.table("daily_surveys").update({
        "kospi_result": kospi_up,
        "kospi_change_pct": round(kospi_change_pct, 2),
        "is_closed": True,
    }).eq("survey_date", d).execute()

    # 정확도 재계산
    responses = supabase.table("survey_responses").select("user_id, kospi_answer").eq("survey_date", d).execute()
    for resp in responses.data:
        supabase.table("accuracy_records").upsert(
            {"user_id": resp["user_id"], "survey_date": d, "kospi_correct": resp["kospi_answer"] == kospi_up},
            on_conflict="user_id,survey_date",
        ).execute()

    logger.info(f"수동 결과 설정: {d} 코스피 {'▲' if kospi_up else '▼'}{kospi_change_pct}%")
    return {"success": True, "survey_date": d, "kospi_change_pct": kospi_change_pct, "kospi_up": kospi_up}


@app.post("/api/admin/trigger-results")
async def trigger_results(force: bool = False):
    if force:
        # 이미 저장된 결과를 초기화하고 재계산
        sb = _supabase_direct()
        sb.table("daily_surveys").update({
            "kospi_result": None,
            "kospi_change_pct": None,
        }).eq("survey_date", today_kst()).execute()
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
