# -*- coding: utf-8 -*-
import os
import asyncio
import threading
import time
import logging
import math
import statistics
from collections import Counter
from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

from contextlib import asynccontextmanager

from krx_calendar import (
    next_trading_day_str,
    today_date_kst,
    korea_public_holiday_on,
    last_n_trading_days_inclusive_through,
)


def today_kst() -> str:
    """KST 기준 오늘 날짜 (Railway는 UTC이므로 명시적으로 변환)"""
    return today_date_kst().isoformat()


import yfinance as yf
import pytz
from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
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

try:
    import stripe as stripe_sdk
except ImportError:
    stripe_sdk = None

from insights_catalog import INSIGHT_PRODUCTS, TOKEN_PACKS, paywall_enabled, stripe_configured
from consumables_catalog import CONSUMABLE_PRODUCTS
from consumables_service import purchase_consumable
from survey_writes import (
    SurveySubmissionLocked,
    fetch_pending_grant,
    persist_survey_answer,
    apply_gauge_adjust_once,
    apply_direction_flip_once,
    apply_pending_presubmits,
)
from token_wallet import (
    entitlement_exists,
    unlock_insight_with_tokens,
    grant_tokens_with_ledger,
)
from accuracy_aggregate import clear_accuracy_cache, get_accuracy_data

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
    """매일 22:00 - 다음 거래일 코스피 예측 설문 텔레그램+웹푸시 발송 (법정 공휴일은 생략)"""
    today_d = today_date_kst()
    if korea_public_holiday_on(today_d):
        logger.info(f"22:00 설문·푸시 생략: 오늘({today_d.isoformat()}) 대한민국 법정공휴일")
        return

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
        title="📊 내일 코스피 예측",
        body="웹 설문에서 슬라이더로 방향·확신도(1% 단위)를 정해 주세요. 마감 09:00",
        notif_type="survey_open",
        url="/survey",
    )
    logger.info("22:00 설문 발송 완료")


async def job_08_45():
    """매일 08:45 - 텔레그램 + 웹푸시 마감임박 알림 (거래일에만 발송)"""
    sb = _supabase_direct()
    today_str = today_kst()

    # 오늘 열린(마감 안 된) 설문이 있는지 확인 — 없으면 공휴일·주말이므로 전송 생략
    open_survey = (
        sb.table("daily_surveys")
        .select("id")
        .eq("survey_date", today_str)
        .eq("is_closed", False)
        .execute()
    )
    if not open_survey.data:
        logger.info(f"08:45 마감임박: 오늘({today_str}) 열린 설문 없음 → 알림 생략 (공휴일/주말 또는 이미 마감)")
        return

    await send_daily_survey_to_all(sb, today_str, is_reminder=True)
    await send_web_push_to_all(
        sb,
        title="⏰ 마감 임박! 09:00까지예요",
        body="웹 설문에서 슬라이더로 방향·확신도(1% 단위)를 확인·제출하세요 📊",
        notif_type="survey_deadline",
        url="/survey",
    )
    logger.info(f"08:45 마감임박 텔레그램+웹푸시 발송 완료: {today_str}")


async def job_09_00():
    """매일 09:00 - 설문 마감 및 집계 결과 발표 (거래일에만)"""
    sb = _supabase_direct()
    today_str = today_kst()

    # 오늘 열린 설문이 없으면 공휴일·주말 → 생략
    open_sv = sb.table("daily_surveys").select("id").eq("survey_date", today_str).eq("is_closed", False).execute()
    if not open_sv.data:
        logger.info(f"09:00 마감: 오늘({today_str}) 열린 설문 없음 → 생략")
        return

    sb.table("daily_surveys").update({"is_closed": True}).eq("survey_date", today_str).execute()
    logger.info(f"설문 마감: {today_str}")

    await announce_results(sb, today_str)


async def job_15_35():
    """매일 15:35 - 종가 조회 → 정확도 계산 → 개인별 알림"""
    # 정확도가 새로 계산되므로 캐시 무효화
    clear_accuracy_cache()

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
        ensure_kospi_tokens_settled_for_date(sb, today_str)

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

    # ── 데이터 수익화용 일별 집계 스냅샷 저장 ──────────────────
    try:
        responses = sb.table("survey_responses").select("kospi_answer, created_at").eq("survey_date", today_str).execute()
        total_votes = len(responses.data)
        if total_votes > 0:
            up_votes   = sum(1 for r in responses.data if r.get("kospi_answer") is True)
            down_votes = total_votes - up_votes
            up_pct     = round(up_votes   / total_votes * 100, 2)
            down_pct   = round(down_votes / total_votes * 100, 2)

            # 투표 시각대별 분포 (KST 기준 시간대)
            hour_dist: dict = {}
            for r in responses.data:
                raw_ts = r.get("created_at", "")
                try:
                    from datetime import datetime, timezone, timedelta
                    kst = timezone(timedelta(hours=9))
                    dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00")).astimezone(kst)
                    h = dt.hour
                    hour_dist[h] = hour_dist.get(h, 0) + 1
                except Exception:
                    pass

            # 다수결 방향
            majority_up = up_votes >= down_votes
            # 고수 강화예측 방향 (daily_surveys 에서 집계)
            ds = sb.table("daily_surveys").select("expert_prediction").eq("survey_date", today_str).execute()
            expert_up = ds.data[0].get("expert_prediction") if ds.data else None

            # 표시용 참여자 수 보정
            # 실제 참여자가 적을 때 기본 참여자(20~27명 랜덤)를 더해 자연스럽게 보이도록
            import random as _rand
            _PAD_THRESHOLD = 28  # 이 수 미만이면 패딩 추가
            if total_votes < _PAD_THRESHOLD:
                pad_total = _rand.randint(20, 27)  # 날마다 달라 보이도록
                # 패딩 참여자는 다수결 방향으로 58~68% 분포
                if majority_up:
                    pad_up_ratio = _rand.uniform(0.58, 0.68)
                else:
                    pad_up_ratio = _rand.uniform(0.32, 0.42)
                pad_up    = round(pad_total * pad_up_ratio)
                pad_down  = pad_total - pad_up
                display_total = total_votes + pad_total
                display_up    = up_votes + pad_up
                display_down  = down_votes + pad_down
            else:
                display_total = total_votes
                display_up    = up_votes
                display_down  = down_votes
            display_up_pct   = round(display_up / display_total * 100, 2)
            display_down_pct = round(display_down / display_total * 100, 2)

            sb.table("survey_summaries").upsert({
                "survey_date":    today_str,
                "total_votes":    display_total,
                "up_votes":       display_up,
                "down_votes":     display_down,
                "up_pct":         display_up_pct,
                "down_pct":       display_down_pct,
                "majority_up":    majority_up,
                "expert_up":      expert_up,
                "kospi_result":   kospi_up,
                "kospi_change_pct": kospi_pct,
                "majority_correct": majority_up == kospi_up,
                "hour_distribution": hour_dist,
            }, on_conflict="survey_date").execute()
            logger.info(f"survey_summaries 저장 완료: {today_str} 실제{total_votes}명→표시{display_total}명 상승{display_up_pct}%")
    except Exception as e:
        logger.warning(f"survey_summaries 저장 실패 (무시): {e}")

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
    logger.info("스케줄러 시작: 22:00(설문 발송·공휴일 제외) / 08:45(마감임박) / 09:00(마감) / 15:35(정확도) / 09-15시 30분(KOSPI 스냅샷)")
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


@app.patch("/api/me/push-preferences")
async def save_push_preferences(
    request: Request,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """알림 종류별 수신 설정 저장"""
    try:
        body = await request.json()
        supabase.table("users").update({"push_preferences": body}).eq("id", str(current_user.id)).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"push_preferences 저장 오류: {e}")
        raise HTTPException(500, str(e))


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


_BAYES_ALPHA = 5  # 베이지안 스무딩 강도 — 표본 5회 미만은 50%로 수렴

def _calc_weighted_pct(responses_with_users: list, accuracy_map: dict, pred_count: dict | None = None) -> int | None:
    """
    누적 정확도 기반 가중예측치 계산 (베이지안 스무딩 적용).
    - 예측 횟수가 적을수록 가중치를 50%(중립) 방향으로 수렴시켜
      표본이 작은 사람이 결과를 독식하는 것을 방지.
    - 베이지안 보정 정확도: (맞힌 수 + α) / (전체 수 + 2α),  α=5
    - weight = (보정_accuracy - 0.5) * 2  →  범위: -1.0 ~ +1.0
    """
    if not responses_with_users:
        return None

    kospi_score = kospi_w = 0.0

    for r in responses_with_users:
        uid = str(r["user_id"])
        raw_acc = accuracy_map.get(uid, 0.5)

        # 베이지안 스무딩: 예측 횟수를 반영해 극단값 보정
        if pred_count and uid in pred_count:
            n = pred_count[uid]
            correct = round(raw_acc * n)
            acc = (correct + _BAYES_ALPHA) / (n + 2 * _BAYES_ALPHA)
        else:
            # 예측 기록 없음 → 중립 처리
            acc = (0 + _BAYES_ALPHA) / (0 + 2 * _BAYES_ALPHA)  # = 0.5

        weight = (acc - 0.5) * 2  # -1 ~ +1

        if weight == 0.0:
            weight = 1.0

        kospi_vote = 1 if r["kospi_answer"] else -1
        kospi_score += weight * kospi_vote
        kospi_w     += abs(weight)

    return round((kospi_score / kospi_w + 1) / 2 * 100) if kospi_w > 0 else None


_settle_rlock_registry_guard = threading.Lock()
_settle_rlocks_by_date: dict[str, threading.RLock] = {}


def _settle_rlock_for(survey_date_str: str) -> threading.RLock:
    """동일 설문일 정산은 한 번에 한 스레드만 (대시보드·잡 중복 호출 시 이중 지급 방지)."""
    with _settle_rlock_registry_guard:
        if survey_date_str not in _settle_rlocks_by_date:
            _settle_rlocks_by_date[survey_date_str] = threading.RLock()
        return _settle_rlocks_by_date[survey_date_str]


def _build_daily_expert_gap_payload(supabase: Client, survey_date_str: str) -> dict | None:
    """
    원시 설문 응답 기반 고수 가중예측 vs 단순 다수결 차이 (공개 대시보드 집계의 패딩은 적용하지 않음).
    """
    res = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", survey_date_str)
        .execute()
    )
    rows = res.data or []
    total = len(rows)
    if total == 0:
        return None
    yes = sum(1 for r in rows if r.get("kospi_answer"))
    simple_pct = round(yes / total * 100)
    acc_map, pred_count, _ = get_accuracy_data(supabase)
    w = _calc_weighted_pct(rows, acc_map, pred_count)
    if w is None:
        w = simple_pct
    gap = w - simple_pct
    direction_simple = "상승" if simple_pct >= 50 else "하락"
    direction_weighted = "상승" if w >= 50 else "하락"
    highlight = "none"
    if direction_simple != direction_weighted:
        highlight = "direction_mismatch"
    elif abs(gap) >= 8:
        highlight = "strong_gap"
    elif abs(gap) >= 4:
        highlight = "moderate_gap"

    bullets = [
        f"표본 크기는 {total}명의 응답 기준입니다.",
        f"단순 다수결은 「{direction_simple}」 쪽 {simple_pct}% 형태입니다.",
        f"누적 적중 반영 가중예측은 「{direction_weighted}」 쪽 지지 형태 {(w)}% 근처로 정렬됩니다.",
        f"(가중예측 − 단순) 괴리는 {gap:+d} 포인트입니다.",
        "표본이 작거나 정확도 기록이 짧으면 두 축은 자연히 가까워질 수 있습니다.",
        "본 리포트는 투자·매매 의사결정이 아닙니다.",
    ]

    return {
        "survey_date": survey_date_str,
        "total_responses": total,
        "simple_pct": simple_pct,
        "weighted_pct": w,
        "gap_points": gap,
        "direction_simple": direction_simple,
        "direction_weighted": direction_weighted,
        "highlight": highlight,
        "bullets": bullets,
        "computed_note": "이 값은 패딩·표시 반올림이 없는 원시 분석 결과일 수 있습니다.",
    }


_MIN_CROWD_CONVICTION_SAMPLE = 20  # crowd_conviction_spread: 플랜 표본 하한
_ROLLING_CROWD_WINDOW_TRADING_DAYS = 7
_MIN_ROLLING_DAY_RESPONSES = 5
_MIN_TIME_SLICE_BUCKET_N = 8
_MIN_TOTAL_TIMESTAMPS_WAVE_B = 30
_MIN_SEGMENT_TIMESTAMPS_VOTE_PROFILE = 15
_SEGMENT_PRED_COUNT_MIN = 5
_EXPERT_NOVICE_FRAC = 0.30
_MIN_SEGMENT_LEADER_PICK = 5  # 고수·하수 1위 픽: 같은 규격 세그먼트 최소 인원
_TIME_SLICE_BUCKET_LABEL_ID = ["pre_market_kst", "morning_trade_kst", "midday_trade_kst", "late_trade_kst"]
_TIME_SLICE_BUCKET_LABEL_KO = [
    "[00:00,09:00) KST",
    "[09:00,12:30) KST",
    "[12:30,15:30) KST",
    "[15:30,24:00] KST",
]


def _coerce_gauge_from_row(row: dict) -> int | None:
    g = row.get("gauge_position")
    if g is not None:
        try:
            gi = int(g)
        except (TypeError, ValueError):
            gi = None
        else:
            if gi != 0 and -100 <= gi <= 100:
                return gi
    ka = row.get("kospi_answer")
    if ka is not None:
        return 50 if ka else -50
    return None


def _gauge_distribution_block(vals: list[int]) -> dict:
    """방향 한쪽 무리의 게이지 통계(빈 리스트는 호출하지 않음)."""
    n = len(vals)
    mean_v = statistics.mean(vals)
    stdev_v = statistics.stdev(vals) if n > 1 else 0.0
    try:
        qs = statistics.quantiles(vals, n=4, method="inclusive")
        q1, median_v, q3 = qs[0], qs[1], qs[2]
    except statistics.StatisticsError:
        sg = sorted(vals)
        median_v = statistics.median(sg)
        mid = len(sg) // 2
        low = sg[:mid] if len(sg) % 2 else sg[:mid]
        high = sg[mid + 1 :] if len(sg) % 2 else sg[mid:]
        q1 = statistics.median(low) if low else median_v
        q3 = statistics.median(high) if high else median_v
    abs_vals = [abs(x) for x in vals]
    mean_abs = statistics.mean(abs_vals)
    return {
        "n": n,
        "mean": round(mean_v, 2),
        "stdev": round(stdev_v, 2),
        "q1": round(float(q1), 2),
        "median": round(float(median_v), 2),
        "q3": round(float(q3), 2),
        "min": min(vals),
        "max": max(vals),
        "mean_abs": round(mean_abs, 2),
    }


def _build_crowd_conviction_spread_payload(
    supabase: Client, survey_date_str: str
) -> tuple[dict | None, str | None]:
    """
    그날 상승 선택·하락 선택 무리별 gauge_position 분포 요약(익명 집계).
    반환: (payload, reason) — no_survey_data | insufficient_sample | None
    """
    res = (
        supabase.table("survey_responses")
        .select("gauge_position, kospi_answer")
        .eq("survey_date", survey_date_str)
        .execute()
    )
    rows = res.data or []
    rise_vals: list[int] = []
    fall_vals: list[int] = []
    for r in rows:
        ka = r.get("kospi_answer")
        g = _coerce_gauge_from_row(r)
        if g is None or ka is None:
            continue
        if bool(ka):
            rise_vals.append(g)
        else:
            fall_vals.append(g)

    total = len(rise_vals) + len(fall_vals)
    if total == 0:
        return (None, "no_survey_data")
    if total < _MIN_CROWD_CONVICTION_SAMPLE:
        return (None, "insufficient_sample")

    rise_block = _gauge_distribution_block(rise_vals) if rise_vals else None
    fall_block = _gauge_distribution_block(fall_vals) if fall_vals else None

    bullets = [
        f"방향까지 기록된 게이지 응답 {total}명(상승 선택 {len(rise_vals)}명 · 하락 선택 {len(fall_vals)}명)입니다.",
        "각 축은 ‘그날 그 방향을 택한 사람들’의 확신도(게이지)만 모아 통계를 냅니다.",
    ]
    if rise_block:
        bullets.append(
            f"상승 선택층: n {rise_block['n']}, 평균 {rise_block['mean']:+.1f}, "
            f"확신 세기 평균(절댓값) {rise_block['mean_abs']:.1f}.",
        )
    if fall_block:
        bullets.append(
            f"하락 선택층: n {fall_block['n']}, 평균 {fall_block['mean']:+.1f}, "
            f"확신 세기 평균(절댓값) {fall_block['mean_abs']:.1f}.",
        )
    bullets.append("투자·매매 의사결정이 아니며 수익을 보장하지 않습니다.")

    payload = {
        "survey_date": survey_date_str,
        "total_n": total,
        "rise_choice_count": len(rise_vals),
        "fall_choice_count": len(fall_vals),
        "rise_choice_stats": rise_block,
        "fall_choice_stats": fall_block,
        "bullets": bullets,
        "computed_note": "옛 응답에 게이지가 없으면 방향만으로 ±50으로 둔 값이 섞일 수 있습니다.",
    }
    return (payload, None)


def _daily_simple_weighted_pct(
    supabase: Client,
    survey_date_str: str,
    acc_map: dict,
    pred_count: dict,
) -> tuple[int | None, int | None, int]:
    """설문 응답이 있는 날만: (simple_pct, weighted_pct, total). total==0 이면 None, None, 0."""
    res = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", survey_date_str)
        .execute()
    )
    rows = res.data or []
    total = len(rows)
    if total == 0:
        return None, None, 0
    yes = sum(1 for r in rows if r.get("kospi_answer"))
    simple_pct = round(yes / total * 100)
    w = _calc_weighted_pct(rows, acc_map, pred_count)
    if w is None:
        w = simple_pct
    return simple_pct, w, total


def _percentages_from_vote_rows(
    rows: list, acc_map: dict, pred_count: dict
) -> tuple[int | None, int | None]:
    if not rows:
        return None, None
    yes = sum(1 for r in rows if r.get("kospi_answer"))
    total = len(rows)
    simple_pct = round(yes / total * 100)
    w = _calc_weighted_pct(rows, acc_map, pred_count)
    if w is None:
        w = simple_pct
    return simple_pct, w


def _build_rolling_crowd_summary_payload(supabase: Client, end_date_str: str) -> tuple[dict | None, str | None]:
    """
    종료 거래일 기준 직전 포함 7거래일 — 일자별 무리 규격 고수층의 코스피 방향 적중률(%).
    """
    try:
        end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return (None, "no_survey_data")
    try:
        dates = last_n_trading_days_inclusive_through(end_d, _ROLLING_CROWD_WINDOW_TRADING_DAYS)
    except ValueError:
        return (None, "no_survey_data")

    acc_map, pred_count, _ = get_accuracy_data(supabase)
    series: list[dict] = []
    any_responses = False
    ok_cells = 0
    for cal in dates:
        ds = cal.isoformat()
        res = (
            supabase.table("survey_responses")
            .select("user_id, kospi_answer")
            .eq("survey_date", ds)
            .execute()
        )
        rows = res.data or []
        kr, _has_row = _kospi_result_for_survey_day(supabase, ds)
        if len(rows) > 0:
            any_responses = True
        day_uids = {str(r["user_id"]) for r in rows if r.get("user_id") is not None}
        experts, _nov = _wave_b_expert_and_novice_ids(day_uids, acc_map, pred_count)
        expert_rows = [r for r in rows if str(r.get("user_id")) in experts]
        en = len(expert_rows)
        result_known = kr is not None
        sample_ok = en >= _MIN_ROLLING_DAY_RESPONSES and result_known
        hit_pct: int | None = None
        if sample_ok and kr is not None and en > 0:
            correct = sum(1 for r in expert_rows if bool(r.get("kospi_answer")) == bool(kr))
            hit_pct = int(round(100 * correct / en))
            ok_cells += 1
        series.append(
            {
                "survey_date": ds,
                "sample_ok": sample_ok,
                "expert_n": en,
                "hit_rate_pct": hit_pct if sample_ok else None,
                "result_known": result_known,
            }
        )

    if not any_responses:
        return (None, "no_survey_data")

    first_s = series[0]["survey_date"]
    last_s = series[-1]["survey_date"]
    bullets = [
        f"종료 거래일 {end_date_str} 기준, 직전 포함 {_ROLLING_CROWD_WINDOW_TRADING_DAYS}거래일({first_s} ~ {last_s})입니다.",
        "각 날짜는 그날 응답자 가운데 무리 규격 ‘고수층’에 들어간 사람만 모아, 코스피 결과가 확정된 날의 적중 비율(%)을 셉니다.",
        f"고수층 인원이 {_MIN_ROLLING_DAY_RESPONSES}명 미만이거나 아직 결과가 없는 날은 수치를 숨깁니다.",
        f"적중률을 채운 칸은 {ok_cells}개입니다.",
        "투자·매매 의사결정이 아니며 수익을 보장하지 않습니다.",
    ]

    return (
        {
            "end_date": end_date_str,
            "window_trading_days": _ROLLING_CROWD_WINDOW_TRADING_DAYS,
            "series": series,
            "bullets": bullets,
            "computed_note": "고수층 정의와 동률 처리는 무리 시간대 카드와 같은 무리 규격입니다.",
        },
        None,
    )



def _wave_b_fetch_survey_with_responded_at(
    supabase: Client, survey_date_str: str
) -> tuple[list[dict] | None, str | None]:
    """err: time_field_unavailable 만 구분한다."""
    try:
        res = (
            supabase.table("survey_responses")
            .select("user_id, kospi_answer, responded_at")
            .eq("survey_date", survey_date_str)
            .execute()
        )
        return res.data or [], None
    except Exception as e:
        logger.warning("survey_responses.responded_at 조회 실패(스키마·RLS 등): %s", e)
        return None, "time_field_unavailable"


def _parse_responded_at_kst(recorded_at) -> datetime | None:
    if recorded_at is None:
        return None
    if isinstance(recorded_at, datetime):
        dt = recorded_at
    else:
        s = str(recorded_at).replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST)


def _bucket_index_from_kst_local(dt_kst: datetime) -> int:
    sec = dt_kst.hour * 3600 + dt_kst.minute * 60 + dt_kst.second
    if sec < 9 * 3600:
        return 0
    if sec < int(12.5 * 3600):
        return 1
    if sec < int(15.5 * 3600):
        return 2
    return 3


def _kospi_result_for_survey_day(supabase: Client, survey_date_str: str) -> tuple[bool | None, bool]:
    """(실제 결정 또는 None 미확정, daily_surveys 행 존재 여부)"""
    row = (
        supabase.table("daily_surveys")
        .select("kospi_result")
        .eq("survey_date", survey_date_str)
        .limit(1)
        .execute()
    )
    if not row.data:
        return None, False
    kr = row.data[0].get("kospi_result")
    if kr is None:
        return None, True
    return bool(kr), True


def _wave_b_expert_and_novice_ids(
    day_user_ids: set[str], acc_map: dict, pred_count: dict
) -> tuple[set[str], set[str]]:
    """pred_count 충족 응답자 기준 고수층 상위·하위 30% 규격(중복 가능성 제거)."""
    eligible = [u for u in day_user_ids if int(pred_count.get(u, 0) or 0) >= _SEGMENT_PRED_COUNT_MIN]
    if not eligible:
        return set(), set()

    cut = max(1, math.ceil(len(eligible) * _EXPERT_NOVICE_FRAC))

    def acc_of(u: str) -> float:
        return float(acc_map.get(u, 0.5))

    best_order = sorted(eligible, key=lambda u: (-acc_of(u), str(u)))
    worst_order = sorted(eligible, key=lambda u: (acc_of(u), str(u)))

    experts = set(best_order[:cut])
    novices: list[str] = []
    for u in worst_order:
        if u in experts:
            continue
        novices.append(u)
        if len(novices) >= cut:
            break
    if len(novices) < cut:
        for u in worst_order:
            if u in novices:
                continue
            novices.append(u)
            if len(novices) >= cut:
                break
    return experts, set(novices)


_MIN_TOP_EXPERT_WINDOW_TIMESTAMPS = 8


def _global_top_expert_uid(supabase: Client) -> tuple[str | None, str | None]:
    """예측 횟수 규격 통과자 중 누적 적중률 1순위(동률 시 id순). 없으면 segment_empty."""
    acc_map, pred_count, _ = get_accuracy_data(supabase)
    eligible = [
        str(uid)
        for uid in pred_count
        if int(pred_count.get(uid, 0) or 0) >= _SEGMENT_PRED_COUNT_MIN
    ]
    if not eligible:
        return None, "segment_empty"

    def acc_of(u: str) -> float:
        return float(acc_map.get(u, 0.5))

    leader = sorted(eligible, key=lambda u: (-acc_of(u), u))[0]
    return leader, None


def _build_leader_pick_payload(
    supabase: Client, survey_date_str: str, cohort: str
) -> tuple[dict | None, str | None]:
    """고수층 또는 하수층 규격 안에서 순위 1명의 그날 코스피 방향(kospi_answer)."""
    res = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer, gauge_position")
        .eq("survey_date", survey_date_str)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None, "no_survey_data"

    acc_map, pred_count, _ = get_accuracy_data(supabase)
    day_uids = {str(r["user_id"]) for r in rows if r.get("user_id") is not None}
    experts, novices = _wave_b_expert_and_novice_ids(day_uids, acc_map, pred_count)
    segment = experts if cohort == "expert" else novices

    if not segment:
        return None, "segment_empty"
    if len(segment) < _MIN_SEGMENT_LEADER_PICK:
        return None, "insufficient_segment_size"

    segment_list = list(segment)

    def acc_of(uid: str) -> float:
        return float(acc_map.get(uid, 0.5))

    if cohort == "expert":
        leader = sorted(segment_list, key=lambda u: (-acc_of(u), u))[0]
        rank_label_ko = "오늘 고수 픽 대상"
    else:
        leader = sorted(segment_list, key=lambda u: (acc_of(u), u))[0]
        rank_label_ko = "오늘 하수 픽 대상"

    pick: bool | None = None
    gauge_v: int | None = None
    for r in rows:
        if str(r["user_id"]) != leader:
            continue
        if r.get("kospi_answer") is None:
            return None, "no_survey_data"
        pick = bool(r["kospi_answer"])
        gauge_v = _coerce_gauge_from_row(r)
        break
    if pick is None:
        return None, "no_survey_data"

    conviction_label_ko = (
        f"확신도(게이지) {gauge_v:+d}" if gauge_v is not None else "확신 게이지 미기록(방향만 반영)"
    )
    urow = supabase.table("users").select("name").eq("id", leader).limit(1).execute()
    name = (urow.data[0].get("name") or "").strip() if urow.data else ""
    masked = (name[0] + "**") if name else "익명"

    pct = round(acc_of(leader) * 100)
    direction_label_ko = "📈 코스피 상승" if pick else "📉 코스피 하락"

    cohort_title = "고수층" if cohort == "expert" else "하수층"
    frac_pct = int(round(_EXPERT_NOVICE_FRAC * 100))
    bullets = [
        (
            f"※ {rank_label_ko}: 그날 설문 응답자 중 예측 횟수 ≥ {_SEGMENT_PRED_COUNT_MIN}, "
            f"무리 규격으로 나뉜 상·하 각 약 {frac_pct}% 층에 들어 간 사람만 대상입니다. "
            + (
                "그중 누적 적중률이 가장 높은 사람 한 명(동률 시 사용자 id 순)입니다."
                if cohort == "expert"
                else "그중 누적 적중률이 가장 낮은 사람 한 명(동률 시 사용자 id 순)입니다."
            )
        ),
        "그날 방향과 게이지를 함께 보여 주는 요약입니다.",
        "무리 규격(고수층·하수층 정의)과 동률 처리는 다른 무리 카드와 같습니다.",
        "닉네임은 초성 형태만 표시합니다.",
        "투자·매매 의사결정이 아니며 수익을 보장하지 않습니다.",
    ]

    computed_note = "적중률은 원시 적중 비율(accuracy_records 분모)입니다."

    payload = {
        "survey_date": survey_date_str,
        "cohort": cohort,
        "cohort_label_ko": cohort_title,
        "rank_label_ko": rank_label_ko,
        "leader_masked_name": masked,
        "leader_accuracy_pct": pct,
        "kospi_answer": pick,
        "direction_label_ko": direction_label_ko,
        "leader_gauge_position": gauge_v,
        "conviction_label_ko": conviction_label_ko,
        "segment_n": len(segment),
        "bullets": bullets,
        "computed_note": computed_note,
    }
    return payload, None


def _timed_user_bucket_records(rows: list[dict]) -> list[tuple[str, bool, int]]:
    out: list[tuple[str, bool, int]] = []
    for r in rows:
        uid = r.get("user_id")
        ka = r.get("kospi_answer")
        if uid is None or ka is None:
            continue
        dt_k = _parse_responded_at_kst(r.get("responded_at"))
        if dt_k is None:
            continue
        b = _bucket_index_from_kst_local(dt_k)
        out.append((str(uid), bool(ka), b))
    return out


def _build_time_slice_accuracy_payload(
    supabase: Client, survey_date_str: str
) -> tuple[dict | None, str | None]:
    """전체 무리에서 적중 1순위 1명이, 종료 거래일까지 직전 7거래일 구간에서 남긴 제출 시각 버킷 분포."""
    leader, tier_err = _global_top_expert_uid(supabase)
    if tier_err:
        return None, tier_err
    try:
        end_d = datetime.strptime(survey_date_str, "%Y-%m-%d").date()
    except ValueError:
        return None, "no_survey_data"
    try:
        dates = last_n_trading_days_inclusive_through(end_d, _ROLLING_CROWD_WINDOW_TRADING_DAYS)
    except ValueError:
        return None, "no_survey_data"
    date_strs = [c.isoformat() for c in dates]

    try:
        res = (
            supabase.table("survey_responses")
            .select("survey_date, responded_at")
            .eq("user_id", leader)
            .in_("survey_date", date_strs)
            .execute()
        )
    except Exception as e:
        logger.warning("time_slice top expert responded_at 조회 실패: %s", e)
        return None, "time_field_unavailable"

    rows = res.data or []
    timed_buckets: list[int] = []
    for r in rows:
        dt_k = _parse_responded_at_kst(r.get("responded_at"))
        if dt_k is None:
            continue
        timed_buckets.append(_bucket_index_from_kst_local(dt_k))

    total_ts = len(timed_buckets)
    if total_ts == 0:
        return None, "no_timestamp_data"
    if total_ts < _MIN_TOP_EXPERT_WINDOW_TIMESTAMPS:
        return None, "insufficient_total_timestamps"

    counts = [0, 0, 0, 0]
    for b in timed_buckets:
        counts[b] += 1

    acc_map, _, _ = get_accuracy_data(supabase)
    pct_leader = round(float(acc_map.get(leader, 0.5)) * 100)
    urow = supabase.table("users").select("name").eq("id", leader).limit(1).execute()
    name = (urow.data[0].get("name") or "").strip() if urow.data else ""
    masked = (name[0] + "**") if name else "익명"

    bucket_rows = []
    for i in range(4):
        n_i = counts[i]
        ok = n_i >= 2
        bucket_rows.append(
            {
                "bucket_id": _TIME_SLICE_BUCKET_LABEL_ID[i],
                "label_ko": _TIME_SLICE_BUCKET_LABEL_KO[i],
                "n": n_i,
                "sample_ok": ok,
                "pct_of_timed_day": round(100 * n_i / total_ts),
                "correct_pct_snapshot": None,
            }
        )

    bullets = [
        f"전체 무리에서 예측 횟수 규격을 통과한 사람 중 누적 적중률 1순위(동률 시 id순) 한 명을 골랐습니다.",
        f"그 참가자의 최근 {_ROLLING_CROWD_WINDOW_TRADING_DAYS}거래일({date_strs[0]} ~ {date_strs[-1]}) 구간에서 제출 시각이 기록된 응답 {total_ts}건을 버킷에 담았습니다.",
        "이름은 초성만 표시합니다.",
        "투자·매매 의사결정이 아니며 수익을 보장하지 않습니다.",
    ]

    return (
        {
            "survey_date": survey_date_str,
            "end_date": survey_date_str,
            "window_trading_days": _ROLLING_CROWD_WINDOW_TRADING_DAYS,
            "leader_masked_name": masked,
            "leader_accuracy_pct": pct_leader,
            "total_with_timestamp": total_ts,
            "kospi_result_known": False,
            "buckets": bucket_rows,
            "bullets": bullets,
            "computed_note": "해당 기간에 응답하지 않은 거래일은 자동으로 제외됩니다.",
        },
        None,
    )


def _build_vote_time_profile_payload(
    supabase: Client, survey_date_str: str, cohort: str
) -> tuple[dict | None, str | None]:
    """cohort expert=정답자, novice=오답자 (그날 kospi_result 확정 후)."""
    rows, err = _wave_b_fetch_survey_with_responded_at(supabase, survey_date_str)
    if err == "time_field_unavailable":
        return None, "time_field_unavailable"
    if not rows:
        return None, "no_survey_data"

    kr, has_row = _kospi_result_for_survey_day(supabase, survey_date_str)
    if not has_row or kr is None:
        return None, "no_kospi_result"

    wants_correct = cohort == "expert"
    cohort_title = "정답자" if wants_correct else "오답자"

    timed = _timed_user_bucket_records(rows)
    filtered = [(uid, ka, b) for uid, ka, b in timed if (ka == kr) == wants_correct]
    total_seg = len(filtered)
    total_gl = len(timed)
    if total_gl < _MIN_TOTAL_TIMESTAMPS_WAVE_B:
        return None, "insufficient_total_timestamps"
    if total_seg == 0:
        return None, "segment_empty"
    if total_seg < _MIN_SEGMENT_TIMESTAMPS_VOTE_PROFILE:
        return None, "insufficient_segment_timestamps"

    seg_counts = [0, 0, 0, 0]
    for _uid, _ka, bix in filtered:
        seg_counts[bix] += 1

    bucket_summ = []
    for i in range(4):
        s_i = seg_counts[i]
        bucket_summ.append(
            {
                "bucket_id": _TIME_SLICE_BUCKET_LABEL_ID[i],
                "label_ko": _TIME_SLICE_BUCKET_LABEL_KO[i],
                "segment_n": s_i,
                "global_n": s_i,
                "segment_share_pct": round(100 * s_i / total_seg) if total_seg else 0,
                "global_share_pct": round(100 * s_i / total_seg) if total_seg else 0,
            }
        )

    bullets = [
        f"※ 그날 코스피 결과가 확정된 뒤에만 집계합니다. {cohort_title}만 모았습니다(제출 시각 기록된 응답만).",
        f"시각 기록 응답 {total_seg}건의 시간대 비율입니다.",
        "버킷 경계는 다른 시간대 카드와 동일한 KST 구간입니다.",
        "투자·매매 의사결정이 아니며 수익을 보장하지 않습니다.",
    ]

    return (
        {
            "survey_date": survey_date_str,
            "cohort": cohort,
            "segment_label_ko": cohort_title,
            "segment_with_timestamp_n": total_seg,
            "global_with_timestamp_n": total_gl,
            "buckets": bucket_summ,
            "bullets": bullets,
            "computed_note": "정답·오답은 그날 survey_date의 kospi_result와 kospi_answer 비교입니다.",
        },
        None,
    )


def _build_user_accuracy_map(supabase: Client) -> dict:
    """하위호환용 래퍼 — acc_map만 반환"""
    acc_map, _, _ = get_accuracy_data(supabase)
    return acc_map


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

    # acc_map, pred_count는 루프 밖에서 한 번만 조회
    try:
        acc_map, hist_pred_count, _ = get_accuracy_data(supabase)
    except Exception:
        acc_map, hist_pred_count = {}, {}

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
    for r in all_resp.data or []:
        resp_by_date.setdefault(r["survey_date"], []).append(r)

    # survey_summaries fallback 조회 (실응답 없는 날 역사 데이터용)
    try:
        summaries_res = (
            supabase.table("survey_summaries")
            .select("survey_date, total_votes, up_votes, majority_up, expert_up, majority_correct")
            .in_("survey_date", survey_dates)
            .execute()
        )
        summary_by_date = {s["survey_date"]: s for s in (summaries_res.data or [])}
    except Exception:
        summary_by_date = {}

    _MIN_DISPLAY_VOTES = 15  # 이 수 미만이면 summary 우선

    results = []
    for row in rows.data:
        d = row["survey_date"]
        resp_list = resp_by_date.get(d, [])
        actual_up = row["kospi_result"]
        summary = summary_by_date.get(d)

        # summary 참여자 수가 더 많으면(또는 실응답이 너무 적으면) summary 우선 사용
        use_summary = (
            summary
            and (summary.get("total_votes") or 0) >= _MIN_DISPLAY_VOTES
            and len(resp_list) < _MIN_DISPLAY_VOTES
        )

        if use_summary:
            s = summary
            total = s.get("total_votes") or 0
            if total == 0:
                continue
            yes_cnt = s.get("up_votes") or 0
            majority_up = bool(s.get("majority_up"))
            majority_correct = bool(s.get("majority_correct"))
            expert_up = s.get("expert_up")
            weighted_up = bool(expert_up) if expert_up is not None else majority_up
            weighted_pct = 68.0 if weighted_up else 32.0
            weighted_correct = weighted_up == actual_up
        elif resp_list:
            # 실제 응답 데이터 사용
            total = len(resp_list)
            yes_cnt = sum(1 for r in resp_list if r["kospi_answer"])
            majority_up = yes_cnt >= total / 2
            majority_correct = majority_up == actual_up
            weighted_pct = _calc_weighted_pct(resp_list, acc_map, hist_pred_count)
            weighted_up = weighted_pct >= 50 if weighted_pct is not None else majority_up
            weighted_correct = weighted_up == actual_up
        elif summary:
            # 실응답 0개 + summary 있음 (소규모라도 표시)
            s = summary
            total = s.get("total_votes") or 0
            if total == 0:
                continue
            yes_cnt = s.get("up_votes") or 0
            majority_up = bool(s.get("majority_up"))
            majority_correct = bool(s.get("majority_correct"))
            expert_up = s.get("expert_up")
            weighted_up = bool(expert_up) if expert_up is not None else majority_up
            weighted_pct = 68.0 if weighted_up else 32.0  # 집계 대표값
            weighted_correct = weighted_up == actual_up
        else:
            continue

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


async def _live_kospi_is_up_and_pct() -> tuple[bool | None, float | None]:
    """네이버 기본 → 야후 순. 전일 종가 대비 등락 방향(get_kospi_price와 동일 소스).
    장 마감 후(또는 유동성 종가 확정 후) 호출해야 함."""
    try:
        url = "https://m.stock.naver.com/api/index/KOSPI/basic"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            d = r.json()
        ratio_str = (d.get("fluctuationsRatio") or "").replace(",", "")
        code = d.get("compareToPreviousPrice", {}).get("code", "")
        naver_pct = float(ratio_str) if ratio_str else None
        if code == "2":
            return True, naver_pct
        if code == "5":
            return False, naver_pct
    except Exception as e:
        logger.warning(f"네이버 KOSPI 결과 조회 실패: {e}")
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; KospiBot/1.0)", "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            meta = resp.json()["chart"]["result"][0]["meta"]
        price = float(meta.get("regularMarketPrice") or 0)
        prev_close = float(meta.get("chartPreviousClose") or meta.get("previousClose") or 0)
        if prev_close:
            change_pct = round((price / prev_close - 1) * 100, 2)
            return price > prev_close, change_pct
    except Exception as e:
        logger.warning(f"Yahoo KOSPI 결과 조회 실패: {e}")
    return None, None


def settle_kospi_survey_day(
    supabase: Client,
    survey_date_str: str,
    is_up: bool,
    change_pct: float | None,
    *,
    update_daily_survey_row: bool = True,
) -> dict:
    """KOSPI 종가 확정 후 accuracy·유저 토큰·스트릭·survey_responses 배당 저장.
    Vercel/온디맨드가 accuracy만 넣었을 때 호출하면 토큰이 보강됨."""
    with _settle_rlock_for(survey_date_str):
        return _settle_kospi_survey_day_inner(
            supabase, survey_date_str, is_up, change_pct,
            update_daily_survey_row=update_daily_survey_row,
        )


def _settle_kospi_survey_day_inner(
    supabase: Client,
    survey_date_str: str,
    is_up: bool,
    change_pct: float | None,
    *,
    update_daily_survey_row: bool = True,
) -> dict:
    """KOSPI 종가 확정 후 accuracy·유저 토큰·스트릭·survey_responses 배당 저장.
    Vercel/온디맨드가 accuracy만 넣었을 때 호출하면 토큰이 보강됨."""
    pct_out = round(float(change_pct), 2) if change_pct is not None else None

    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer, gauge_position, tokens_bet, tokens_before, tokens_won")
        .eq("survey_date", survey_date_str)
        .execute()
    )
    rows = responses.data or []

    if (
        not update_daily_survey_row
        and rows
        and all(r.get("tokens_won") is not None for r in rows)
    ):
        return {
            "ok": True,
            "date": survey_date_str,
            "participants": len(rows),
            "game_overs": 0,
            "tokens_settled": False,
            "changePct": pct_out,
            "isUp": is_up,
        }

    if update_daily_survey_row:
        try:
            supabase.table("daily_surveys").update({
                "kospi_result": is_up,
                "kospi_change_pct": pct_out,
                "is_closed": True,
            }).eq("survey_date", survey_date_str).execute()
        except Exception as e:
            logger.error(f"daily_surveys 결과 반영 실패 ({survey_date_str}): {e}")
            raise

    survey_info = supabase.table("daily_surveys").select("kospi_yes_pct").eq("survey_date", survey_date_str).execute()
    kospi_yes_pct = survey_info.data[0].get("kospi_yes_pct") if survey_info.data else 50
    if kospi_yes_pct is None:
        total_n = len(rows)
        yes_cnt = sum(1 for r in rows if r.get("kospi_answer"))
        kospi_yes_pct = round(yes_cnt / total_n * 100) if total_n > 0 else 50

    crowd_up = max(5, kospi_yes_pct)
    crowd_dn = max(5, 100 - kospi_yes_pct)

    all_group_members = supabase.table("group_members").select("user_id").execute()
    group_user_ids = {m["user_id"] for m in (all_group_members.data or [])}

    game_overs = 0
    did_token_row = False
    for r in rows:
        uid = r["user_id"]

        gp = r.get("gauge_position")
        if gp is None:
            gp = 50 if r.get("kospi_answer") else -50
        else:
            gp = int(gp)
        is_up_bet = gp > 0
        prediction_correct = bool(r.get("kospi_answer")) == is_up
        correct_game = is_up_bet == is_up

        supabase.table("accuracy_records").upsert(
            {"user_id": uid, "survey_date": survey_date_str, "kospi_correct": prediction_correct},
            on_conflict="user_id,survey_date",
        ).execute()

        if r.get("tokens_won") is not None:
            continue

        did_token_row = True

        u_row = supabase.table("users").select(
            "tokens, current_streak, game_over_count, streak_shield_charges",
        ).eq("id", uid).execute()
        if not u_row.data:
            continue
        u = u_row.data[0]
        tokens = u.get("tokens") or 100
        streak = u.get("current_streak") or 0
        game_over_count = u.get("game_over_count") or 0
        shield_charges = int(u.get("streak_shield_charges") or 0)

        payout_mult = round(crowd_dn / crowd_up, 3) if is_up_bet else round(crowd_up / crowd_dn, 3)
        streak_mult = 2.0 if streak >= 5 else (1.5 if streak >= 3 else 1.0)

        tokens_bet = r.get("tokens_bet") or max(1, round(abs(gp) / 100 * tokens))
        participation_bonus = 10 if uid in group_user_ids else 5

        new_shields = shield_charges
        if correct_game:
            won = int(tokens_bet * payout_mult * streak_mult)
            new_tokens = tokens + won + participation_bonus
            new_streak = streak + 1
        else:
            won = -tokens_bet
            new_tokens = tokens - tokens_bet + participation_bonus
            if shield_charges > 0:
                new_shields = shield_charges - 1
                new_streak = streak
            else:
                new_shields = shield_charges
                new_streak = 0

        game_over = new_tokens <= 0
        if game_over:
            new_tokens = 100
            game_over_count += 1
            game_overs += 1

        supabase.table("users").update({
            "tokens": new_tokens,
            "current_streak": new_streak,
            "game_over_count": game_over_count,
            "streak_shield_charges": new_shields,
        }).eq("id", uid).execute()

        supabase.table("survey_responses").update({
            "payout_multiplier": payout_mult,
            "tokens_won": won,
        }).eq("user_id", uid).eq("survey_date", survey_date_str).is_("tokens_won", "null").execute()

    if update_daily_survey_row or did_token_row:
        clear_accuracy_cache()

    return {
        "ok": True,
        "date": survey_date_str,
        "changePct": pct_out,
        "isUp": is_up,
        "participants": len(rows),
        "game_overs": game_overs,
        "tokens_settled": did_token_row,
    }


def ensure_kospi_tokens_settled_for_date(supabase: Client, survey_date_str: str) -> None:
    """DB에 종가 결과만 있고 토큰 정산이 빠진 날 보강 (Vercel·온디맨드 분기 등)."""
    try:
        ds = (
            supabase.table("daily_surveys")
            .select("kospi_result, kospi_change_pct")
            .eq("survey_date", survey_date_str)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.warning(f"daily_surveys 조회 오류 ({survey_date_str}): {e}")
        return

    if not ds.data or ds.data.get("kospi_result") is None:
        return

    # 정산 필요한 응답이 없으면 즉시 반환 — 매 요청마다 전 참가자 순회하면 타임아웃→Failed to fetch
    try:
        pending = (
            supabase.table("survey_responses")
            .select("user_id")
            .eq("survey_date", survey_date_str)
            .is_("tokens_won", "null")
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning(f"survey_responses 정산 필요 여부 조회 실패: {e}")
        return

    if not pending.data:
        return

    is_up = bool(ds.data["kospi_result"])
    raw_pct = ds.data.get("kospi_change_pct")
    pct = float(raw_pct) if raw_pct is not None else None

    try:
        settle_kospi_survey_day(
            supabase, survey_date_str, is_up, pct,
            update_daily_survey_row=False,
        )
    except Exception as e:
        logger.error(f"토큰 정산 보강 실패 ({survey_date_str}): {e}")


async def _persist_kospi_survey_close_if_needed(supabase: Client, survey_date_str: str) -> bool:
    """오늘 날짜만, 장마감(15:35 KST 이후)·DB 미기록 시 Vercel/스케줄 실패 분기까지 실시간으로 보강.

    과거 거래일은 여기서 다루지 않음 — 실시간 API는 오늘만 의미 있음."""
    if survey_date_str != today_kst():
        return False
    now_kst = datetime.now(KST)
    if now_kst.hour * 60 + now_kst.minute < 15 * 60 + 35:
        return False

    try:
        ds = (
            supabase.table("daily_surveys")
            .select("kospi_result")
            .eq("survey_date", survey_date_str)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.warning(f"daily_surveys 조회 실패 ({survey_date_str}): {e}")
        return False

    if not ds.data or ds.data.get("kospi_result") is not None:
        return False

    is_up, raw_pct = await _live_kospi_is_up_and_pct()
    if is_up is None:
        logger.info(f"KOSPI 실시간 방향 확인 불가 → DB 미기록 survey_date={survey_date_str}")
        return False

    pct_val = round(float(raw_pct), 2) if raw_pct is not None else None
    try:
        settle_kospi_survey_day(
            supabase, survey_date_str, is_up, pct_val,
            update_daily_survey_row=True,
        )
    except Exception as e:
        logger.error(f"KOSPI 보강·토큰 정산 실패: {e}")
        return False

    logger.info(f"KOSPI 결과 DB 보강(온디맨드): {survey_date_str} {'▲' if is_up else '▼'} {pct_val}%")
    return True


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
    raw_pct    = payload.get("changePct")
    change_pct = float(raw_pct) if raw_pct is not None else None
    is_up      = bool(payload.get("isUp", True))

    return settle_kospi_survey_day(
        supabase, date, is_up, change_pct,
        update_daily_survey_row=True,
    )


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
        for r in all_resp.data or []:
            resp_by_date.setdefault(r["survey_date"], []).append(r)

        acc_map, bt_pred_count, _ = get_accuracy_data(supabase)

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

            wpct = _calc_weighted_pct(resp_list, acc_map, bt_pred_count)
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


async def _build_today_payload(supabase: Client, *, detail: bool) -> dict:
    """
    detail=True: 전체 응답 행·정확도 맵·참여자 목록(대시보드용).
    detail=False: 설문 탭용 요약 — 응답 수만 head count, 참여자/가중/다수결 생략.
    """
    today_str = today_kst()

    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
    if not survey_res.data:
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
    if survey.get("kospi_result") is None:
        refreshed = await _persist_kospi_survey_close_if_needed(supabase, today_str)
        if refreshed:
            survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", today_str).execute()
            survey = survey_res.data[0]

    try:
        ensure_kospi_tokens_settled_for_date(supabase, today_str)
    except Exception as e:
        logger.warning(f"get_today 토큰 정산 보강 스킵: {e}")

    if survey.get("kospi_result") is not None:
        status = "result"
    elif survey["is_closed"]:
        status = "closed"
    else:
        status = "open"

    if not detail:
        total = 0
        try:
            cnt_res = (
                supabase.table("survey_responses")
                .select("user_id", count="exact", head=True)
                .eq("survey_date", today_str)
                .execute()
            )
            c = getattr(cnt_res, "count", None)
            if c is not None:
                total = int(c)
        except Exception as e:
            logger.warning("오늘 설문 응답 수 count 실패, 폴백: %s", e)
            try:
                fb = (
                    supabase.table("survey_responses")
                    .select("user_id")
                    .eq("survey_date", today_str)
                    .execute()
                )
                total = len(fb.data or [])
            except Exception:
                total = 0

        return {
            "status": status,
            "survey_date": today_str,
            "total_responses": total,
            "kospi_yes_pct": None,
            "kospi_weighted_pct": None,
            "kospi_result": survey.get("kospi_result"),
            "kospi_change_pct": survey.get("kospi_change_pct"),
        }

    responses = (
        supabase.table("survey_responses")
        .select("user_id, kospi_answer")
        .eq("survey_date", today_str)
        .execute()
    )
    total = len(responses.data)

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
        import random as _rand
        kospi_yes = sum(1 for r in responses.data if r["kospi_answer"])
        raw_yes_pct = kospi_yes / total

        _PAD_THRESHOLD = 28
        if total < _PAD_THRESHOLD:
            pad_n = _rand.randint(20, 27)
            majority_up = raw_yes_pct >= 0.5
            pad_up_ratio = _rand.uniform(0.58, 0.68) if majority_up else _rand.uniform(0.32, 0.42)
            pad_yes = round(pad_n * pad_up_ratio)
            display_yes = kospi_yes + pad_yes
            display_total = total + pad_n
        else:
            display_yes = kospi_yes
            display_total = total

        base["kospi_yes_pct"] = round(display_yes / display_total * 100)

        acc_map, pred_count, _ = get_accuracy_data(supabase)
        raw_weighted = _calc_weighted_pct(responses.data, acc_map, pred_count)
        if raw_weighted is not None and total < _PAD_THRESHOLD:
            raw_dir = raw_weighted >= 50
            pad_w = _rand.uniform(0.58, 0.68) if raw_dir else _rand.uniform(0.32, 0.42)
            base["kospi_weighted_pct"] = round(
                (raw_weighted * total + pad_w * 100 * pad_n) / display_total
            )
        else:
            base["kospi_weighted_pct"] = raw_weighted

        all_uids = [str(r["user_id"]) for r in responses.data]

        try:
            name_rows = supabase.table("users").select("id, name").in_("id", all_uids).execute()
            name_map = {str(row["id"]): row["name"] for row in (name_rows.data or [])}
        except Exception:
            name_map = {}

        def _make_entry(uid: str, r: dict) -> dict:
            name = name_map.get(uid, "")
            masked = (name[0] + "**") if name else "익명"
            acc_val = acc_map.get(uid)
            return {
                "user_id": uid,
                "masked_name": masked,
                "kospi_answer": r["kospi_answer"],
                "accuracy": round(acc_val * 100) if acc_val is not None else None,
                "total_predictions": pred_count.get(uid, 0),
            }

        resp_map = {str(r["user_id"]): r for r in responses.data}

        participants = [_make_entry(uid, resp_map[uid]) for uid in all_uids]
        participants.sort(key=lambda x: (-(x["accuracy"] or -1), -x["total_predictions"]))
        base["participants"] = participants

        try:
            candidates = [uid for uid in all_uids if uid in acc_map]
            if candidates:
                top_uid = max(candidates, key=lambda u: (acc_map[u], pred_count.get(u, 0)))
                worst_uid = min(candidates, key=lambda u: (acc_map[u], -pred_count.get(u, 0)))
                base["top_predictor"] = _make_entry(top_uid, resp_map[top_uid])
                if len(candidates) >= 2 and worst_uid != top_uid:
                    base["worst_predictor"] = _make_entry(worst_uid, resp_map[worst_uid])
        except Exception as e:
            logger.warning(f"고수/하수 조회 실패: {e}")

    return base


@app.get("/api/today/summary")
async def get_today_summary(supabase: Client = Depends(get_supabase)):
    """설문 탭 빠른 첫 페인트용. 참여자·가중·다수결 패딩 없음 — 대시보드는 /api/today 사용."""
    return await _build_today_payload(supabase, detail=False)


@app.get("/api/today")
async def get_today(supabase: Client = Depends(get_supabase)):
    """오늘의 설문 집계 결과 조회 (인증 불필요)"""
    return await _build_today_payload(supabase, detail=True)


@app.post("/api/survey/respond")
async def web_survey_respond(
    request: Request,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """웹에서 설문 응답 제출. 동일 거래일은 1회만(재투표 아이템으로 1회 수정)."""
    user_id = str(current_user.id)

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
    gauge_position = body.get("gauge_position")
    if gauge_position is not None:
        gauge_position = int(gauge_position)
        if not (-100 <= gauge_position <= 100) or gauge_position == 0:
            raise HTTPException(status_code=422, detail="gauge_position은 -100~100 범위의 0이 아닌 값이어야 합니다.")
        kospi_answer = gauge_position > 0
    else:
        kospi_answer = body.get("kospi_answer")
        gauge_position = 50 if kospi_answer else -50

    today_str = today_kst()
    target_date = body.get("survey_date") or today_str

    if kospi_answer is None:
        raise HTTPException(status_code=422, detail="kospi_answer 또는 gauge_position이 필요합니다.")

    survey_res = supabase.table("daily_surveys").select("*").eq("survey_date", target_date).execute()
    if not survey_res.data:
        raise HTTPException(status_code=400, detail="해당 날짜의 설문이 없습니다.")
    survey = survey_res.data[0]
    survey_closed = bool(survey.get("is_closed"))

    apply_pending_presubmits(supabase, user_id)

    try:
        out = persist_survey_answer(
            supabase,
            user_id,
            target_date,
            gauge_position,
            survey_closed=survey_closed,
        )
    except SurveySubmissionLocked as e:
        raise HTTPException(status_code=400, detail=e.detail) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("survey_responses 저장 오류")
        raise HTTPException(status_code=500, detail=f"응답 저장 중 오류: {e}") from e

    return {
        "success": True,
        "survey_date": out["survey_date"],
        "tokens_bet": out["tokens_bet"],
        "current_tokens": out["current_tokens"],
    }


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
        .select("kospi_answer, gauge_position, tokens_bet") \
        .eq("user_id", user_id) \
        .eq("survey_date", target_date) \
        .execute()
    if res.data:
        row = res.data[0]
        gp = row.get("gauge_position")
        if gp is None:
            gp = 50 if row["kospi_answer"] else -50
        return {
            "answered": True,
            "kospi_answer": row["kospi_answer"],
            "gauge_position": int(gp),
            "tokens_bet": row.get("tokens_bet"),
        }
    return {"answered": False, "kospi_answer": None, "gauge_position": None, "tokens_bet": None}


@app.get("/api/survey/pending-grant")
async def get_pending_survey_grant(
    survey_date: str | None = None,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """미소비 설문 수정 권한(재투표·게이지·방향반전) — 소모품 구매 후 설문 화면에서 사용."""
    user_id = str(current_user.id)
    sd = survey_date.strip() if survey_date else today_kst()
    row = fetch_pending_grant(supabase, user_id, sd)
    if not row:
        return {"grant_kind": None}
    return {"grant_kind": row.get("grant_kind")}


class SurveyGaugeAdjustBody(BaseModel):
    survey_date: str
    gauge_position: int


class SurveyDateBody(BaseModel):
    survey_date: str


class ConsumablePurchaseBody(BaseModel):
    consumable_slug: str
    survey_date: str | None = None
    gauge_position: int | None = None
    idempotency_key: str


@app.post("/api/survey/adjust-gauge")
async def survey_adjust_gauge(
    body: SurveyGaugeAdjustBody,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    sd = body.survey_date.strip()
    if len(sd) != 10:
        raise HTTPException(status_code=400, detail="survey_date 형식 오류")
    if sd != today_kst():
        raise HTTPException(
            status_code=400,
            detail="게이지만 조정은 오늘의 설문(당일 거래일)에만 적용됩니다.",
        )
    srv = supabase.table("daily_surveys").select("is_closed").eq("survey_date", sd).execute()
    if not srv.data:
        raise HTTPException(status_code=400, detail="해당 설문 없음")
    try:
        out = apply_gauge_adjust_once(
            supabase, str(current_user.id), sd, body.gauge_position, survey_closed=bool(srv.data[0]["is_closed"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("adjust-gauge")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"success": True, **out}


@app.post("/api/survey/flip-direction")
async def survey_flip_direction(
    body: SurveyDateBody,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    sd = body.survey_date.strip()
    if len(sd) != 10:
        raise HTTPException(status_code=400, detail="survey_date 형식 오류")
    if sd != today_kst():
        raise HTTPException(
            status_code=400,
            detail="방향 반전은 오늘의 설문(당일 거래일)에만 적용됩니다.",
        )
    srv = supabase.table("daily_surveys").select("is_closed").eq("survey_date", sd).execute()
    if not srv.data:
        raise HTTPException(status_code=400, detail="해당 설문 없음")
    try:
        out = apply_direction_flip_once(
            supabase, str(current_user.id), sd, survey_closed=bool(srv.data[0]["is_closed"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("flip-direction")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"success": True, **out}


@app.post("/api/consumables/purchase")
async def post_consumable_purchase(
    body: ConsumablePurchaseBody,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    if not body.idempotency_key or len(body.idempotency_key) < 8:
        raise HTTPException(status_code=400, detail="idempotency_key가 필요합니다 (8자 이상).")
    if body.consumable_slug not in CONSUMABLE_PRODUCTS:
        raise HTTPException(status_code=400, detail="알 수 없는 소모품입니다.")
    try:
        out = purchase_consumable(
            supabase,
            str(current_user.id),
            body.consumable_slug,
            idempotency_key=body.idempotency_key.strip(),
            survey_date=body.survey_date,
            gauge_position=body.gauge_position,
        )
    except RuntimeError:
        raise HTTPException(status_code=503, detail="토큰 동시성 충돌 — 잠시 후 다시 시도해 주세요.") from None
    if not out.get("ok"):
        code = 400
        if out.get("error") == "insufficient_tokens":
            code = 402
        raise HTTPException(status_code=code, detail=out)
    return out


@app.get("/api/next-survey")
async def get_next_survey(supabase: Client = Depends(get_supabase)):
    """다음 거래일 설문 상태 반환 (장마감 후 미리 예측 참여용)
    레코드가 없으면 자동 생성 후 is_open: true 반환"""
    next_str = next_trading_day_str()
    res = supabase.table("daily_surveys").select("survey_date, is_closed").eq("survey_date", next_str).execute()
    if res.data:
        if not res.data[0]["is_closed"]:
            return {"survey_date": next_str, "is_open": True}
        return {"survey_date": next_str, "is_open": False}
    # 레코드 없으면 자동 생성
    try:
        supabase.table("daily_surveys").insert({
            "survey_date": next_str,
            "is_closed": False,
        }).execute()
        logger.info(f"next-survey: {next_str} 설문 레코드 자동 생성")
    except Exception as e:
        logger.warning(f"next-survey: 레코드 생성 실패 (무시): {e}")
    return {"survey_date": next_str, "is_open": True}


# ─────────────────────────────────────────────────────────────────────────────
# 그룹 (Groups) 엔드포인트
# ─────────────────────────────────────────────────────────────────────────────
import random, string

def _gen_invite_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

class GroupCreateRequest(BaseModel):
    name: str

class GroupJoinRequest(BaseModel):
    invite_code: str

@app.post("/api/groups")
async def create_group(
    body: GroupCreateRequest,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """그룹 생성. 생성자는 자동으로 멤버 추가."""
    user_id = str(current_user.id)
    code = _gen_invite_code()
    # 충돌 방지
    for _ in range(5):
        existing = supabase.table("groups").select("id").eq("invite_code", code).execute()
        if not existing.data:
            break
        code = _gen_invite_code()

    group = supabase.table("groups").insert(
        {"name": body.name, "invite_code": code, "owner_id": user_id}
    ).execute()
    group_id = group.data[0]["id"]
    supabase.table("group_members").insert({"group_id": group_id, "user_id": user_id}).execute()
    return {"ok": True, "group_id": group_id, "invite_code": code}


@app.post("/api/groups/join")
async def join_group(
    body: GroupJoinRequest,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """초대 코드로 그룹 가입."""
    user_id = str(current_user.id)
    code = body.invite_code.strip().upper()
    grp = supabase.table("groups").select("id, name").eq("invite_code", code).execute()
    if not grp.data:
        raise HTTPException(404, "초대 코드를 찾을 수 없어요")
    group_id = grp.data[0]["id"]
    existing = supabase.table("group_members").select("id").eq("group_id", group_id).eq("user_id", user_id).execute()
    if existing.data:
        raise HTTPException(400, "이미 참여 중인 그룹이에요")
    supabase.table("group_members").insert({"group_id": group_id, "user_id": user_id}).execute()
    return {"ok": True, "group_id": group_id, "group_name": grp.data[0]["name"]}


@app.get("/api/groups/me")
async def get_my_groups(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """내가 속한 그룹 목록 (배치 조회 — 그룹당 N+1 제거)"""
    user_id = str(current_user.id)
    memberships = supabase.table("group_members").select("group_id").eq("user_id", user_id).execute()
    if not memberships.data:
        return []

    gids_order = [m["group_id"] for m in memberships.data]
    uniq_gids = list(dict.fromkeys(gids_order))

    gr = (
        supabase.table("groups")
        .select("id, name, invite_code, owner_id")
        .in_("id", uniq_gids)
        .execute()
    )
    groups_by_id = {g["id"]: g for g in (gr.data or [])}

    gm = (
        supabase.table("group_members")
        .select("group_id")
        .in_("group_id", uniq_gids)
        .execute()
    )
    member_per_group = Counter(m["group_id"] for m in (gm.data or []))

    result = []
    seen: set = set()
    for gid in gids_order:
        if gid in seen:
            continue
        seen.add(gid)
        g = groups_by_id.get(gid)
        if not g:
            continue
        result.append({
            "group_id": g["id"],
            "name": g["name"],
            "invite_code": g["invite_code"],
            "is_owner": g["owner_id"] == user_id,
            "member_count": member_per_group.get(gid, 0),
        })
    return result


@app.get("/api/groups/{group_id}/leaderboard")
async def get_group_leaderboard(
    group_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """그룹 내 멤버 순위 (누적 적중률 기준) — 배치 조회 + accuracy 집계 캐시 1회"""
    user_id = str(current_user.id)
    mem_check = supabase.table("group_members").select("id").eq("group_id", group_id).eq("user_id", user_id).execute()
    if not mem_check.data:
        raise HTTPException(403, "그룹 멤버만 볼 수 있어요")

    members = supabase.table("group_members").select("user_id").eq("group_id", group_id).execute()
    member_ids = [str(m["user_id"]) for m in (members.data or [])]

    open_sv = (
        supabase.table("daily_surveys")
        .select("survey_date")
        .eq("is_closed", False)
        .is_("kospi_result", "null")
        .order("survey_date")
        .limit(1)
        .execute()
    )
    vote_check_date = open_sv.data[0]["survey_date"] if open_sv.data else today_kst()

    grp = supabase.table("groups").select("name, invite_code").eq("id", group_id).execute()
    base_out = {
        "group_id": group_id,
        "group_name": grp.data[0]["name"] if grp.data else "",
        "invite_code": grp.data[0]["invite_code"] if grp.data else "",
    }

    if not member_ids:
        return {**base_out, "members": []}

    _, _, user_scores = get_accuracy_data(supabase)

    name_rows = supabase.table("users").select("id, name").in_("id", member_ids).execute()
    name_map = {str(row["id"]): (row.get("name") or "") for row in (name_rows.data or [])}

    voted_res = (
        supabase.table("survey_responses")
        .select("user_id")
        .eq("survey_date", vote_check_date)
        .in_("user_id", member_ids)
        .execute()
    )
    voted_set = {str(r["user_id"]) for r in (voted_res.data or [])}

    rows = []
    for uid in member_ids:
        name = name_map.get(uid, "")
        masked = (name[0] + "**") if name else "익명"
        sc = user_scores.get(uid) or {"correct": 0, "total": 0}
        total = int(sc["total"])
        correct = int(sc["correct"])
        accuracy = round(correct / total * 100) if total > 0 else None
        rows.append({
            "user_id": uid,
            "masked_name": masked,
            "is_me": uid == user_id,
            "accuracy": accuracy,
            "total_predictions": total,
            "correct": correct,
            "voted_today": uid in voted_set,
        })

    rows.sort(key=lambda r: (-(r["accuracy"] or -1), -r["total_predictions"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    return {**base_out, "members": rows}


@app.post("/api/groups/{group_id}/nudge")
async def nudge_group(
    group_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """오늘 설문 미참여 그룹 멤버에게 독촉 알림 발송"""
    from telegram_bot import send_message as tg_send
    from webpush_helper import send_web_push_to_user
    from urllib.parse import quote

    user_id = str(current_user.id)

    # 멤버 확인
    mem_check = supabase.table("group_members").select("id").eq("group_id", group_id).eq("user_id", user_id).execute()
    if not mem_check.data:
        raise HTTPException(403, "그룹 멤버만 독촉할 수 있어요")

    today_str = today_kst()

    # 현재 열려있는 설문 날짜 확인 (마감 전 설문 or 다음 거래일 예약 설문)
    open_survey = (
        supabase.table("daily_surveys")
        .select("survey_date")
        .eq("is_closed", False)
        .is_("kospi_result", "null")
        .order("survey_date")
        .limit(1)
        .execute()
    )
    target_date = open_survey.data[0]["survey_date"] if open_survey.data else today_str

    # 그룹명 + 발신자 이름
    grp = supabase.table("groups").select("name").eq("id", group_id).execute()
    group_name = grp.data[0]["name"] if grp.data else "그룹"
    sender_row = supabase.table("users").select("name").eq("id", user_id).execute()
    sender_name = sender_row.data[0]["name"] if sender_row.data else "익명"
    sender_masked = (sender_name[0] + "**") if sender_name else "익명"

    # 전체 멤버 중 대상 설문 미참여자 (투표·텔레그램 id 배치 조회 후 루프)
    members = supabase.table("group_members").select("user_id").eq("group_id", group_id).execute()
    raw_members = members.data or []
    other_ids = [str(m["user_id"]) for m in raw_members if str(m["user_id"]) != user_id]

    voted_set: set[str] = set()
    tg_by_uid: dict[str, str | None] = {}
    if other_ids:
        voted_res = (
            supabase.table("survey_responses")
            .select("user_id")
            .eq("survey_date", target_date)
            .in_("user_id", other_ids)
            .execute()
        )
        voted_set = {str(r["user_id"]) for r in (voted_res.data or [])}

        tg_rows = supabase.table("users").select("id, telegram_chat_id").in_("id", other_ids).execute()
        tg_by_uid = {str(r["id"]): r.get("telegram_chat_id") for r in (tg_rows.data or [])}

    notified = 0
    no_channel = 0   # 미참여이지만 알림 수단 없는 멤버 수
    all_voted  = 0   # 이미 참여한 멤버 수

    for uid in other_ids:
        if uid in voted_set:
            all_voted += 1
            continue  # 이미 참여한 멤버 제외

        app_base = os.getenv("NEXT_PUBLIC_APP_URL", "https://kospi-prediction.vercel.app")
        tg_link = f"{app_base}/survey?nudge_from={quote(sender_masked)}&nudge_group={quote(group_name)}"
        tg_text = (
            f"📣 <b>설문 독촉!</b>\n\n"
            f"<b>[{group_name}]</b> 그룹의 <b>{sender_masked}</b>님이 독촉장을 보냈어요!\n\n"
            f"아직 코스피 예측을 안 하셨네요 👀\n"
            f"얼른 참여해서 순위를 지켜내세요! 🏆\n\n"
            f"👉 <a href=\"{tg_link}\">지금 바로 예측하기</a>"
        )
        push_title = f"📣 {sender_masked}님이 독촉장을 보냈어요!"
        push_body  = f"[{group_name}] 아직 오늘 코스피 예측 안 하셨네요 👀 얼른 참여해서 순위 지켜내세요! 🏆"

        # 링크에 발신자·그룹 정보 포함 — 설문 페이지에서 토스트로 표시
        nudge_url = f"/survey?nudge_from={quote(sender_masked)}&nudge_group={quote(group_name)}"

        sent_any = False

        # 웹 푸시 시도
        pushed = send_web_push_to_user(supabase, uid, push_title, push_body, nudge_url, notif_type="group_nudge")
        if pushed:
            sent_any = True
            logger.info(f"독촉 웹 푸시 전송 성공: target={uid}")

        # 텔레그램 시도
        chat_id = tg_by_uid.get(uid)
        if chat_id:
            try:
                await tg_send(chat_id, tg_text)
                sent_any = True
                logger.info(f"독촉 텔레그램 전송 성공: target={uid}")
            except Exception as e:
                logger.warning(f"독촉 텔레그램 실패: target={uid}, {e}")

        if sent_any:
            notified += 1
        else:
            no_channel += 1
            logger.info(f"독촉 대상 {uid}: 알림 수단 없음 (push_subscription/telegram_chat_id 미설정)")

    logger.info(f"독촉 결과: group={group_id}, target_date={target_date}, 전송={notified}, 알림수단없음={no_channel}, 이미참여={all_voted}")

    if notified == 0:
        if no_channel > 0:
            return {"ok": True, "notified": 0, "message": f"미참여 멤버 {no_channel}명이 브라우저 알림을 켜지 않아 전송할 수 없어요 😥\n설정 → 브라우저 알림을 켜달라고 안내해주세요!"}
        return {"ok": True, "notified": 0, "message": "모두 이미 참여했어요 🎉"}
    return {"ok": True, "notified": notified, "message": f"{notified}명에게 독촉 알림을 보냈어요!"}


@app.delete("/api/groups/{group_id}/leave")
async def leave_group(
    group_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """그룹 탈퇴"""
    user_id = str(current_user.id)
    supabase.table("group_members").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
    return {"ok": True}


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
        .insert({
            "challenger_id": challenger_id,
            "challenged_id": challenged_id,
            "survey_date": date_str,
            "outcome": "pending",
            "accepted": None,  # None = 수락 대기 중
        })
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
        notif_type="challenge",
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

    sent_list = sent_res.data or []
    recv_list = recv_res.data or []
    opponent_ids: set[str] = set()
    for c in sent_list:
        opponent_ids.add(str(c["challenged_id"]))
    for c in recv_list:
        opponent_ids.add(str(c["challenger_id"]))

    name_map: dict[str, str] = {}
    if opponent_ids:
        name_rows = supabase.table("users").select("id, name").in_("id", list(opponent_ids)).execute()
        name_map = {str(r["id"]): (r.get("name") or "") for r in (name_rows.data or [])}

    def _masked(uid: str) -> str:
        name = name_map.get(str(uid), "")
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
            "accepted": c.get("accepted"),          # None=대기, True=수락, False=거절
            "duel_group_id": c.get("duel_group_id"),# 수락 시 생성된 전용 그룹 ID
        }

    return {
        "sent":     [_enrich(c, True)  for c in sent_list],
        "received": [_enrich(c, False) for c in recv_list],
    }


@app.post("/api/challenges/{challenge_id}/accept")
async def accept_challenge(
    challenge_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """대결 수락 → 두 사람 전용 그룹 자동 생성"""
    from telegram_bot import send_message as tg_send
    from webpush_helper import send_web_push_to_user

    user_id = str(current_user.id)
    ch_res = supabase.table("challenges").select("*").eq("id", challenge_id).execute()
    if not ch_res.data:
        raise HTTPException(404, "대결을 찾을 수 없어요")

    ch = ch_res.data[0]
    if ch["challenged_id"] != user_id:
        raise HTTPException(403, "받은 대결만 수락할 수 있어요")
    if ch.get("accepted") is not None:
        raise HTTPException(400, "이미 처리된 대결이에요")

    challenger_id = ch["challenger_id"]

    # 두 사람 이름 조회
    c_row = supabase.table("users").select("name").eq("id", challenger_id).execute()
    d_row = supabase.table("users").select("name").eq("id", user_id).execute()
    c_name = (c_row.data[0]["name"] or "익명") if c_row.data else "익명"
    d_name = (d_row.data[0]["name"] or "익명") if d_row.data else "익명"
    c_masked = (c_name[0] + "**") if c_name else "익명"
    d_masked = (d_name[0] + "**") if d_name else "익명"

    # 전용 대결 그룹 생성
    invite_code = _gen_invite_code()
    grp = supabase.table("groups").insert({
        "name": f"{c_masked} vs {d_masked} 대결",
        "invite_code": invite_code,
        "owner_id": challenger_id,
    }).execute()
    group_id = grp.data[0]["id"]

    # 두 명 모두 그룹에 가입
    supabase.table("group_members").insert([
        {"group_id": group_id, "user_id": challenger_id},
        {"group_id": group_id, "user_id": user_id},
    ]).execute()

    # 대결 레코드 업데이트
    supabase.table("challenges").update({
        "accepted": True,
        "duel_group_id": group_id,
    }).eq("id", challenge_id).execute()

    # 신청자에게 수락 알림
    c_tg_row = supabase.table("users").select("telegram_chat_id").eq("id", challenger_id).execute()
    if c_tg_row.data and c_tg_row.data[0].get("telegram_chat_id"):
        try:
            await tg_send(
                c_tg_row.data[0]["telegram_chat_id"],
                f"⚔️ <b>대결 수락!</b>\n\n"
                f"<b>{d_masked}</b>님이 대결을 수락했어요!\n"
                f"장 마감 후 결과를 함께 확인해봐요 🔥",
            )
        except Exception as e:
            logger.warning(f"대결 수락 텔레그램 알림 실패: {e}")

    send_web_push_to_user(
        supabase, challenger_id,
        title="⚔️ 대결 수락됐어요!",
        body=f"{d_masked}님이 대결을 수락했어요! 장 마감 후 결과를 확인해보세요 🔥",
        url="/dashboard",
        notif_type="challenge",
    )

    return {"ok": True, "group_id": group_id, "group_name": f"{c_masked} vs {d_masked} 대결"}


@app.post("/api/challenges/{challenge_id}/decline")
async def decline_challenge(
    challenge_id: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """대결 거절"""
    user_id = str(current_user.id)
    ch_res = supabase.table("challenges").select("*").eq("id", challenge_id).execute()
    if not ch_res.data:
        raise HTTPException(404, "대결을 찾을 수 없어요")

    ch = ch_res.data[0]
    if ch["challenged_id"] != user_id:
        raise HTTPException(403, "받은 대결만 거절할 수 있어요")
    if ch.get("accepted") is not None:
        raise HTTPException(400, "이미 처리된 대결이에요")

    supabase.table("challenges").update({"accepted": False, "outcome": "no_result"}).eq("id", challenge_id).execute()
    return {"ok": True}


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

    send_web_push_to_user(supabase, opponent_id, "⚔️ 상대방이 반응했어요!", push_body, "/dashboard", notif_type="challenge")

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

    send_web_push_to_user(supabase, opponent_id, "🔥 재대결 신청이 왔어요!", push_body, "/dashboard", notif_type="challenge")

    return {"ok": True, "challenge_id": result.data[0]["id"] if result.data else None, "survey_date": next_str}


# ─────────────────────────────────────────────────────────────────────────────

def _survey_date_key(d) -> str:
    """Supabase DATE가 str / date 객체로 올 때 조회 키 통일."""
    if d is None:
        return ""
    if hasattr(d, "isoformat"):
        return str(d.isoformat())[:10]
    s = str(d).strip()
    return s[:10] if len(s) >= 10 else s


@app.get("/api/dashboard")
async def get_dashboard(
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """내 예측 이력 + 정확도 + 상위 퍼센트"""
    user_id = str(current_user.id)

    try:
        try:
            await _persist_kospi_survey_close_if_needed(supabase, today_kst())
        except Exception as ex:
            logger.warning("대시보드: KOSPI 종가 보강 스킵 — %s", ex)
        try:
            ensure_kospi_tokens_settled_for_date(supabase, today_kst())
        except Exception as ex:
            logger.warning("대시보드: 토큰 정산 보강 스킵 — %s", ex)

        # 유저 토큰 + 스트릭 조회
        user_row = supabase.table("users").select("tokens, current_streak").eq("id", user_id).execute()
        user_tokens = user_row.data[0].get("tokens", 100) if user_row.data else 100
        user_streak = user_row.data[0].get("current_streak", 0) if user_row.data else 0

        my_responses = (
            supabase.table("survey_responses")
            .select("survey_date, kospi_answer, gauge_position, tokens_bet, tokens_won, payout_multiplier")
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

        accuracy_map = {_survey_date_key(r["survey_date"]): r for r in (my_accuracy_res.data or [])}
        responses_rows = my_responses.data or []

        # daily_surveys.in_ 에 넣을 날짜는 문자열 YYYY-MM-DD 로 통일 (date 객체 혼합 방지)
        unique_dates_raw = list(
            {_survey_date_key(resp["survey_date"]) for resp in responses_rows if resp.get("survey_date") is not None}
        )
        unique_dates_raw = [d for d in unique_dates_raw if len(d) >= 8]
        kospi_result_by_date: dict = {}
        if unique_dates_raw:
            ds_bulk = (
                supabase.table("daily_surveys")
                .select("survey_date, kospi_result")
                .in_("survey_date", unique_dates_raw)
                .execute()
            )
            for row in ds_bulk.data or []:
                kospi_result_by_date[_survey_date_key(row["survey_date"])] = row.get("kospi_result")

        history = []
        for resp in responses_rows:
            d_key = _survey_date_key(resp["survey_date"])
            acc = accuracy_map.get(d_key, {})
            kospi_correct = acc.get("kospi_correct")
            kr = kospi_result_by_date.get(d_key)
            if kospi_correct is None and (kr is True or kr is False):
                kospi_correct = bool(resp["kospi_answer"]) == bool(kr)

            history.append({
                "date": d_key or resp["survey_date"],
                "kospi_answer": resp["kospi_answer"],
                "kospi_correct": kospi_correct,
                "kospi_market_result": kr if (kr is True or kr is False) else None,
                "gauge_position": resp.get("gauge_position"),
                "tokens_bet": resp.get("tokens_bet"),
                "tokens_won": resp.get("tokens_won"),
                "payout_multiplier": resp.get("payout_multiplier"),
            })

        total_with_result = sum(1 for h in history if h["kospi_correct"] is not None)

        if total_with_result == 0:
            return {
                "accuracy": {"kospi": None, "overall": None},
                "percentile": None,
                "contribution": None,
                "history": history,
                "total_predictions": len(responses_rows),
                "tokens": user_tokens,
                "current_streak": user_streak,
            }

        kospi_correct_cnt = sum(1 for h in history if h["kospi_correct"])
        kospi_acc = round(kospi_correct_cnt / total_with_result * 100)

        top_pct = None
        contribution = None
        try:
            _, _, user_scores = get_accuracy_data(supabase)
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
        except Exception as ex:
            logger.warning("대시보드: 상위 퍼센트·기여도 계산 스킵 — %s", ex)

        return {
            "accuracy": {"kospi": kospi_acc, "overall": kospi_acc},
            "percentile": top_pct,
            "contribution": contribution,
            "history": history,
            "total_predictions": len(responses_rows),
            "tokens": user_tokens,
            "current_streak": user_streak,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("대시보드 조회 실패 user=%s", user_id)
        raise HTTPException(
            status_code=500,
            detail="대시보드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ) from e


class InsightUnlockBody(BaseModel):
    product_slug: str
    survey_date: str
    idempotency_key: str
    group_id: str | None = None


class CheckoutPackBody(BaseModel):
    pack_slug: str
    success_url: str | None = None
    cancel_url: str | None = None


@app.get("/api/insights/daily-expert-gap")
async def get_daily_expert_gap(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    고수 가중예측 vs 단순 다수결 차이 리포트.
    paywall 활성 시 열람 entitlement 없으면 data 없이 가격만 반환.
    """
    user_id = str(current_user.id)
    sd = survey_date.strip()
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")

    slug = "daily_expert_gap"
    if slug not in INSIGHT_PRODUCTS:
        raise HTTPException(status_code=500, detail="상품 설정 오류")

    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])

    user_row = supabase.table("users").select("tokens").eq("id", user_id).execute()
    balance = int(user_row.data[0].get("tokens") or 100) if user_row.data else 100

    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)

    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload = _build_daily_expert_gap_payload(supabase, sd)
    if payload is None:
        return {
            "accessible": False,
            "locked": wall and not has_entitlement,
            "reason": "no_survey_data",
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "data": None,
        }

    if not unlocked:
        return {
            "accessible": False,
            "locked": True,
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "description": meta.get("description"),
            "data": None,
        }

    return {
        "accessible": True,
        "locked": False,
        "survey_date": sd,
        "product_slug": slug,
        "price_tokens": price_tokens,
        "balance": balance,
        "title": meta["title"],
        "data": payload,
    }



@app.get("/api/insights/crowd-conviction-spread")
async def get_crowd_conviction_spread(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    무리 게이지(확신) 분포 요약 — 본인 참여 불필요, 최소 표본(n≥20) 미만이면 열람·차감 대상 없음.
    """
    user_id = str(current_user.id)
    sd = survey_date.strip()
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")

    slug = "crowd_conviction_spread"
    if slug not in INSIGHT_PRODUCTS:
        raise HTTPException(status_code=500, detail="상품 설정 오류")
    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])

    user_row = supabase.table("users").select("tokens").eq("id", user_id).execute()
    balance = int(user_row.data[0].get("tokens") or 100) if user_row.data else 100

    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)
    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload, err_reason = _build_crowd_conviction_spread_payload(supabase, sd)

    if err_reason == "no_survey_data":
        return {
            "accessible": False,
            "locked": wall and not has_entitlement,
            "reason": "no_survey_data",
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "data": None,
        }

    if err_reason == "insufficient_sample":
        return {
            "accessible": False,
            "locked": False,
            "reason": "insufficient_sample",
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "description": meta.get("description"),
            "data": None,
        }

    assert payload is not None

    if not unlocked:
        return {
            "accessible": False,
            "locked": True,
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "description": meta.get("description"),
            "data": None,
        }

    return {
        "accessible": True,
        "locked": False,
        "survey_date": sd,
        "product_slug": slug,
        "price_tokens": price_tokens,
        "balance": balance,
        "title": meta["title"],
        "reason": None,
        "data": payload,
    }


@app.get("/api/insights/rolling-crowd-summary")
async def get_rolling_crowd_summary(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    최근 7거래일 무리 요약. 쿼리 survey_date는 **종료 거래일**(윈도우의 마지막 날 후보 — 비거래일이면 직전 거래일로 보정되어 집계).
    """
    user_id = str(current_user.id)
    sd = survey_date.strip()
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")

    slug = "rolling_crowd_summary"
    if slug not in INSIGHT_PRODUCTS:
        raise HTTPException(status_code=500, detail="상품 설정 오류")
    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])

    user_row = supabase.table("users").select("tokens").eq("id", user_id).execute()
    balance = int(user_row.data[0].get("tokens") or 100) if user_row.data else 100

    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)
    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload, err_reason = _build_rolling_crowd_summary_payload(supabase, sd)

    if err_reason == "no_survey_data":
        return {
            "accessible": False,
            "locked": wall and not has_entitlement,
            "reason": "no_survey_data",
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "data": None,
        }

    assert payload is not None

    if not unlocked:
        return {
            "accessible": False,
            "locked": True,
            "survey_date": sd,
            "product_slug": slug,
            "price_tokens": price_tokens,
            "balance": balance,
            "title": meta["title"],
            "description": meta.get("description"),
            "data": None,
        }

    return {
        "accessible": True,
        "locked": False,
        "survey_date": sd,
        "product_slug": slug,
        "price_tokens": price_tokens,
        "balance": balance,
        "title": meta["title"],
        "reason": None,
        "data": payload,
    }


def _unlock_precheck_wave_b_insight(supabase: Client, product_slug: str, survey_date_iso: str) -> None:
    """데이터 불충족 시 400으로 잠금 해제 차단."""
    if product_slug == "time_slice_accuracy":
        _, er = _build_time_slice_accuracy_payload(supabase, survey_date_iso)
    elif product_slug == "expert_vote_time_profile":
        _, er = _build_vote_time_profile_payload(supabase, survey_date_iso, "expert")
    elif product_slug == "novice_vote_time_profile":
        _, er = _build_vote_time_profile_payload(supabase, survey_date_iso, "novice")
    else:
        return
    if er is None:
        return
    if er == "time_field_unavailable":
        raise HTTPException(status_code=400, detail="responded_at 시각 필드를 조회할 수 없습니다. 마이그레이션 확인을 해 주세요.")
    if er == "no_survey_data":
        raise HTTPException(status_code=400, detail="그날 설문 응답이 없어 구매할 수 없습니다.")
    if er == "no_kospi_result":
        raise HTTPException(status_code=400, detail="코스피 결과가 확정된 뒤에만 구매할 수 있습니다.")
    if er == "no_timestamp_data":
        raise HTTPException(status_code=400, detail="해당 거래일에 제출 시각이 기록된 응답이 없습니다.")
    if er == "insufficient_total_timestamps":
        raise HTTPException(
            status_code=400,
            detail=(
                f"시각 기록이 최소 기준에 못 미칩니다(최고 고수 카드는 최근 구간 합산 {_MIN_TOP_EXPERT_WINDOW_TIMESTAMPS}건 이상, 그 외 무리 시간 카드는 {_MIN_TOTAL_TIMESTAMPS_WAVE_B}건 이상)."
            ),
        )
    if er == "segment_empty":
        if product_slug == "time_slice_accuracy":
            raise HTTPException(status_code=400, detail="최고 고수 후보 무리 규격을 만족하는 표본이 없습니다.")
        raise HTTPException(status_code=400, detail="정답·오답 인원 또는 세그먼트 조건을 만족하지 않습니다.")
    if er == "insufficient_segment_timestamps":
        raise HTTPException(
            status_code=400,
            detail=f"{_MIN_SEGMENT_TIMESTAMPS_VOTE_PROFILE}명 미만이면 해당 세그먼트 시간 카드를 살 수 없습니다.",
        )
    raise HTTPException(status_code=400, detail="이 거래일은 아직 카드 제공 조건을 만족하지 않습니다.")


def _unlock_precheck_leader_pick(supabase: Client, product_slug: str, survey_date_iso: str) -> None:
    if product_slug == "expert_leader_pick":
        cohort = "expert"
    elif product_slug == "novice_leader_pick":
        cohort = "novice"
    else:
        return
    _, er = _build_leader_pick_payload(supabase, survey_date_iso, cohort)
    if er is None:
        return
    if er == "no_survey_data":
        raise HTTPException(status_code=400, detail="그날 설문 응답이 없어 구매할 수 없습니다.")
    if er == "segment_empty":
        raise HTTPException(status_code=400, detail="고수/하수층을 구분할 표본 자격군이 부족합니다.")
    if er == "insufficient_segment_size":
        raise HTTPException(
            status_code=400,
            detail=f"동일 규격 세그먼트 응답이 {_MIN_SEGMENT_LEADER_PICK}명 미만이면 구매할 수 없습니다.",
        )
    raise HTTPException(status_code=400, detail="이 거래일은 아직 카드 제공 조건을 만족하지 않습니다.")


@app.get("/api/insights/time-slice-accuracy")
async def get_time_slice_accuracy(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = str(current_user.id)
    sd = survey_date.strip()
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")
    slug = "time_slice_accuracy"
    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])
    balance = _user_token_balance_safe(supabase, user_id)
    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)
    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload, err_reason = _build_time_slice_accuracy_payload(supabase, sd)
    soft = lambda **kw: {**kw, "survey_date": sd, "product_slug": slug, "price_tokens": price_tokens, "balance": balance, "title": meta["title"]}

    if err_reason == "time_field_unavailable":
        return soft(accessible=False, locked=False, reason="time_field_unavailable", description=meta.get("description"), data=None)
    if err_reason == "no_survey_data":
        return soft(accessible=False, locked=wall and not has_entitlement, reason="no_survey_data", data=None)
    if err_reason == "no_kospi_result":
        return soft(accessible=False, locked=False, reason="no_kospi_result", description=meta.get("description"), data=None)
    if err_reason == "no_timestamp_data":
        return soft(accessible=False, locked=False, reason="no_timestamp_data", description=meta.get("description"), data=None)
    if err_reason == "insufficient_total_timestamps":
        return soft(accessible=False, locked=False, reason="insufficient_total_timestamps", description=meta.get("description"), data=None)
    if err_reason == "segment_empty":
        return soft(accessible=False, locked=False, reason="segment_empty", description=meta.get("description"), data=None)

    assert payload is not None
    if not unlocked:
        return soft(accessible=False, locked=True, description=meta.get("description"), data=None)

    return {
        **soft(accessible=True, locked=False),
        "reason": None,
        "data": payload,
    }


@app.get("/api/insights/expert-vote-time-profile")
async def get_expert_vote_time_profile(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _vote_time_profile_insight_response(supabase, str(current_user.id), survey_date.strip(), "expert")


@app.get("/api/insights/novice-vote-time-profile")
async def get_novice_vote_time_profile(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _vote_time_profile_insight_response(supabase, str(current_user.id), survey_date.strip(), "novice")


@app.get("/api/insights/expert-leader-pick")
async def get_expert_leader_pick(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _leader_pick_insight_response(supabase, str(current_user.id), survey_date.strip(), "expert")


@app.get("/api/insights/novice-leader-pick")
async def get_novice_leader_pick(
    survey_date: str,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return _leader_pick_insight_response(supabase, str(current_user.id), survey_date.strip(), "novice")


def _user_token_balance_safe(supabase: Client, user_id: str) -> int:
    user_row = supabase.table("users").select("tokens").eq("id", user_id).execute()
    return int(user_row.data[0].get("tokens") or 100) if user_row.data else 100


def _vote_time_profile_insight_response(
    supabase: Client, user_id: str, sd: str, cohort: str
) -> dict:
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")
    slug = "expert_vote_time_profile" if cohort == "expert" else "novice_vote_time_profile"
    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])
    balance = _user_token_balance_safe(supabase, user_id)
    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)
    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload, err_reason = _build_vote_time_profile_payload(supabase, sd, cohort)
    soft = lambda **kw: {**kw, "survey_date": sd, "product_slug": slug, "price_tokens": price_tokens, "balance": balance, "title": meta["title"]}

    if err_reason == "time_field_unavailable":
        return soft(accessible=False, locked=False, reason="time_field_unavailable", description=meta.get("description"), data=None)
    if err_reason == "no_survey_data":
        return soft(accessible=False, locked=wall and not has_entitlement, reason="no_survey_data", data=None)
    if err_reason == "no_kospi_result":
        return soft(accessible=False, locked=False, reason="no_kospi_result", description=meta.get("description"), data=None)
    if err_reason == "segment_empty":
        return soft(accessible=False, locked=False, reason="segment_empty", description=meta.get("description"), data=None)
    if err_reason == "insufficient_total_timestamps":
        return soft(accessible=False, locked=False, reason="insufficient_total_timestamps", description=meta.get("description"), data=None)
    if err_reason == "insufficient_segment_timestamps":
        return soft(accessible=False, locked=False, reason="insufficient_segment_timestamps", description=meta.get("description"), data=None)

    assert payload is not None
    if not unlocked:
        return soft(accessible=False, locked=True, description=meta.get("description"), data=None)

    return {**soft(accessible=True, locked=False), "reason": None, "data": payload}


def _leader_pick_insight_response(supabase: Client, user_id: str, sd: str, cohort: str) -> dict:
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식은 YYYY-MM-DD 여야 합니다.")
    slug = "expert_leader_pick" if cohort == "expert" else "novice_leader_pick"
    meta = INSIGHT_PRODUCTS[slug]
    price_tokens = int(meta["price_tokens"])
    balance = _user_token_balance_safe(supabase, user_id)
    has_entitlement = entitlement_exists(supabase, user_id, slug, sd)
    wall = paywall_enabled()
    unlocked = (not wall) or has_entitlement

    payload, err_reason = _build_leader_pick_payload(supabase, sd, cohort)
    soft = lambda **kw: {
        **kw,
        "survey_date": sd,
        "product_slug": slug,
        "price_tokens": price_tokens,
        "balance": balance,
        "title": meta["title"],
    }

    if err_reason == "no_survey_data":
        return soft(accessible=False, locked=wall and not has_entitlement, reason="no_survey_data", data=None)
    if err_reason == "segment_empty":
        return soft(accessible=False, locked=False, reason="segment_empty", description=meta.get("description"), data=None)
    if err_reason == "insufficient_segment_size":
        return soft(accessible=False, locked=False, reason="insufficient_segment_size", description=meta.get("description"), data=None)

    assert payload is not None
    if not unlocked:
        return soft(accessible=False, locked=True, description=meta.get("description"), data=None)

    return {**soft(accessible=True, locked=False), "reason": None, "data": payload}


@app.post("/api/insights/unlock")
async def post_insight_unlock(
    body: InsightUnlockBody,
    current_user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = str(current_user.id)
    sd = body.survey_date.strip()
    if len(sd) != 10 or sd[4] != "-" or sd[7] != "-":
        raise HTTPException(status_code=400, detail="survey_date 형식 오류(YEAR-MM-DD)")
    if body.product_slug not in INSIGHT_PRODUCTS:
        raise HTTPException(status_code=400, detail="알 수 없는 상품입니다.")
    if not body.idempotency_key or len(body.idempotency_key) < 8:
        raise HTTPException(status_code=400, detail="idempotency_key가 필요합니다 (8자 이상).")

    meta = INSIGHT_PRODUCTS[body.product_slug]
    cost = int(meta["price_tokens"])

    scope_key = sd

    if body.product_slug in ("expert_leader_pick", "novice_leader_pick"):
        _unlock_precheck_leader_pick(supabase, body.product_slug, sd)
    else:
        _unlock_precheck_wave_b_insight(supabase, body.product_slug, sd)

    if not paywall_enabled():
        return {"ok": True, "skipped": True, "message": "페이월 비활성"}

    try:
        out = unlock_insight_with_tokens(
            supabase,
            user_id,
            product_slug=body.product_slug,
            scope_key=scope_key,
            price_tokens=cost,
            idempotency_key=body.idempotency_key.strip(),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.error(f"unlock_insight 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="잠금 해제 처리 중 오류가 발생했습니다.") from e

    if not out.get("ok"):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_tokens",
                "required": out.get("required", cost),
                "balance": out.get("balance", 0),
            },
        )
    return out


@app.get("/api/shop/catalog")
async def shop_catalog(current_user=Depends(get_current_user)):
    _ = current_user
    packs = []
    for p in TOKEN_PACKS:
        env_name = p.get("stripe_price_env") or ""
        price_id = os.getenv(env_name, "").strip() if env_name else ""
        packs.append(
            {
                "slug": p["slug"],
                "tokens": p["tokens"],
                "price_label": p.get("price_label"),
                "stripe_price_configured": bool(price_id),
            }
        )
    return {
        "insight_products": [
            {"slug": k, **v} for k, v in INSIGHT_PRODUCTS.items()
        ],
        "consumable_products": [
            {"slug": k, **v} for k, v in CONSUMABLE_PRODUCTS.items()
        ],
        "token_packs": packs,
        "stripe_ready": bool(stripe_sdk and stripe_configured()),
        "paywall_enabled": paywall_enabled(),
    }


@app.post("/api/shop/checkout-session")
async def create_pack_checkout_session(
    body: CheckoutPackBody,
    current_user=Depends(get_current_user),
):
    if not stripe_sdk or not os.getenv("STRIPE_SECRET_KEY"):
        raise HTTPException(status_code=503, detail="Stripe 결제가 아직 설정되지 않았습니다.")
    user_id = str(current_user.id)
    pack = next((x for x in TOKEN_PACKS if x["slug"] == body.pack_slug), None)
    if not pack:
        raise HTTPException(status_code=400, detail="알 수 없는 팩입니다.")
    env_name = pack.get("stripe_price_env") or ""
    price_id = os.getenv(env_name, "").strip()
    if not price_id:
        raise HTTPException(status_code=503, detail=f"환경변수 {env_name} 가 비어 있습니다.")

    base = os.getenv("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
    success = (body.success_url or f"{base}/shop?paid=1").strip()
    cancel = (body.cancel_url or f"{base}/shop?cancel=1").strip()

    stripe_sdk.api_key = os.getenv("STRIPE_SECRET_KEY")
    try:
        session = stripe_sdk.checkout.Session.create(
            mode="payment",
            success_url=success + ("&session_id={CHECKOUT_SESSION_ID}" if "?" in success else "?session_id={CHECKOUT_SESSION_ID}"),
            cancel_url=cancel,
            client_reference_id=user_id,
            metadata={
                "user_id": user_id,
                "pack_slug": pack["slug"],
                "tokens_grant": str(int(pack["tokens"])),
            },
            line_items=[{"price": price_id, "quantity": 1}],
        )
    except Exception as e:
        logger.error(f"Stripe checkout 생성 실패: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="결제 세션을 만들지 못했습니다.") from e

    return {"url": session.url, "session_id": session.id}


@app.post("/api/stripe/webhook")
async def stripe_webhook_route(request: Request):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not stripe_sdk or not secret:
        raise HTTPException(status_code=503, detail="웹훅 비활성")

    payload = await request.body()
    sig = request.headers.get("stripe-signature") or ""

    try:
        event = stripe_sdk.Webhook.construct_event(payload, sig, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid payload") from None
    except Exception as e:
        if type(e).__name__ == "SignatureVerificationError":
            raise HTTPException(status_code=400, detail="invalid signature") from e
        logger.warning(f"Stripe webhook construct_event: {e}")
        raise HTTPException(status_code=400, detail="invalid webhook") from e

    if event["type"] != "checkout.session.completed":
        return {"received": True}

    sess = event["data"]["object"]
    meta = sess.get("metadata") or {}
    uid = meta.get("user_id")
    grant = meta.get("tokens_grant")
    sid = sess.get("id")

    if not uid or grant is None or not sid:
        logger.warning(f"stripe webhook 메타 불완전: {meta}")
        return {"received": True}

    sb = _supabase_direct()

    try:
        new_bal = grant_tokens_with_ledger(
            sb,
            uid,
            delta=int(grant),
            reason="stripe_token_pack",
            ref_type="stripe_checkout_session",
            ref_id=str(sid),
            idempotency_key=f"stripe_checkout:{sid}",
        )
        logger.info(f"Stripe 충전 완료 user={uid} +{grant} 잔액={new_bal}")
    except PermissionError:
        logger.error(f"Stripe 충전 대상 사용자 없음: {uid}")
    except Exception as e:
        logger.error(f"Stripe 충전 처리 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="ledger 실패") from e

    return {"received": True}


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
    await job_22_00()
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
