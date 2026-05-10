"use client";

import { useCallback, useEffect, useState } from "react";
import type { Group } from "@/lib/api";
import { useConfirmShopOnInsufficientTokens } from "@/hooks/useConfirmShopOnInsufficientTokens";
import InsightAnimatedPreview from "@/components/InsightAnimatedPreview";
import InsightTokenPriceButton from "@/components/InsightTokenPriceButton";
import InsightDetailDisclosure from "@/components/InsightDetailDisclosure";
import { insightMeta } from "@/lib/insight_card_meta";
import {
  getGroupVsGlobalInsight,
  GroupVsGlobalInsightResponse,
  unlockInsightProduct,
  InsightInsufficientTokensError,
} from "@/lib/api";

const META = insightMeta("group_vs_global_snapshot");

interface Props {
  accessToken: string;
  surveyDate: string;
  groups: Group[];
  onBalanceUpdated?: () => void;
}

/** 내 그룹 vs 전체 (그룹·날짜별 scope, 토큰 잠금) */
export default function GroupVsGlobalInsightCard({
  accessToken,
  surveyDate,
  groups,
  onBalanceUpdated,
}: Props) {
  const confirmShopOnInsufficientTokens = useConfirmShopOnInsufficientTokens();
  const [groupId, setGroupId] = useState<string>(() => groups[0]?.group_id ?? "");
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<GroupVsGlobalInsightResponse | null>(null);

  useEffect(() => {
    if (groups.length && !groups.some((g) => g.group_id === groupId)) {
      setGroupId(groups[0].group_id);
    }
  }, [groups, groupId]);

  const load = useCallback(async () => {
    setErr(null);
    if (!groupId || !groups.some((g) => g.group_id === groupId)) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await getGroupVsGlobalInsight(accessToken, surveyDate, groupId);
      setData(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, surveyDate, groupId, groups]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlock = async () => {
    if (!groupId) return;
    setUnlocking(true);
    setErr(null);
    try {
      await unlockInsightProduct(accessToken, {
        product_slug: "group_vs_global_snapshot",
        survey_date: surveyDate,
        group_id: groupId,
        idempotency_key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `unlock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await load();
      onBalanceUpdated?.();
    } catch (e: unknown) {
      if (e instanceof InsightInsufficientTokensError) {
        void confirmShopOnInsufficientTokens(e.detail);
      } else {
        alert(e instanceof Error ? e.message : "잠금 해제 실패");
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          그룹에 참여한 뒤에만「내 그룹 vs 전체」인사이트를 열 수 있어요. 그룹 화면에서 초대 코드로 들어오면 됩니다.
        </p>
      </div>
    );
  }

  if (!groupId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-4 fade-up-2 animate-pulse">
        <div className="h-4 w-52 rounded bg-[#333] mb-2" />
        <div className="h-16 rounded bg-[#222]" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300 fade-up-2">
        인사이트 카드 로드 실패: {err}
        <button type="button" onClick={() => void load()} className="block mt-2 text-xs underline">
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (data.reason === "not_group_member") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 text-xs text-gray-400 fade-up-2">
        선택한 그룹에 속해 있지 않아 이 카드를 볼 수 없어요.
      </div>
    );
  }

  if (data.reason === "no_survey_data") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 거래일(<span className="text-gray-300 tabular-nums">{data.survey_date}</span>)에는 아직 무리 설문 응답이 없습니다.
        </p>
      </div>
    );
  }

  if (data.reason === "insufficient_group_sample") {
    return (
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414]/80 px-4 py-3 space-y-1.5 fade-up-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          그룹 참가자 중 그날 설문한 인원이 <span className="text-gray-300">8명</span> 미만이라 이 스냅샷은 열 수 없습니다(토큰 차감 없음).
          멤버가 더 모이거나 같은 날 응답이 늘면 다시 시도할 수 있어요.
        </p>
      </div>
    );
  }

  const locked = data.locked === true || !data.accessible;
  const priceTokens = data.price_tokens ?? META.priceTokens;

  const groupLabel =
    groups.find((g) => g.group_id === groupId)?.name ?? data.data?.group_name ?? "그룹";

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/30 to-[#141414]/90 px-4 py-4 space-y-3 fade-up-2 shadow-[0_0_28px_rgba(52,211,153,.07)]">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-wide">토큰 인사이트</p>
            <p className="text-sm font-black text-white mt-0.5">{data.title ?? "그룹 vs 전체"}</p>
            <p className="text-[10px] text-gray-600 mt-0.5 tabular-nums">{data.survey_date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InsightTokenPriceButton
              priceTokens={priceTokens}
              className="border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
              locked={locked}
              unlocking={unlocking}
              onActivate={() => void handleUnlock()}
            />
            <span className="text-xl" aria-hidden>
              {locked ? "🔐" : "✨"}
            </span>
          </div>
        </div>
        <InsightAnimatedPreview slug="group_vs_global_snapshot" />
        <InsightDetailDisclosure accentSummaryClass="text-emerald-400/85 hover:text-emerald-300">
          <p>{META.hint}</p>
          {locked ? (
            <>
              <p className="text-gray-500">
                {data.description ?? "내 그룹 무리만 따로 묶어 전체와 같은 축으로 하루치를 비교합니다."}
              </p>
              <p className="text-gray-500">비교 대상: {groupLabel}</p>
            </>
          ) : null}
        </InsightDetailDisclosure>
        <label className="text-[11px] text-gray-400 flex flex-col gap-1">
          <span className="text-gray-500">비교할 그룹</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-lg border border-[#333] bg-[#111] text-white text-sm px-3 py-2 outline-none focus:border-emerald-500/50"
          >
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.name} ({g.member_count}명)
              </option>
            ))}
          </select>
        </label>
      </div>

      {!locked ? (
        <>
          <p className="text-[10px] text-gray-500">{data.data?.computed_note}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px] tabular-nums border border-white/[0.06] rounded-lg p-2">
            <div className="text-gray-500">그룹 n / 전체 n</div>
            <div className="text-right text-gray-200">
              {data.data?.group.n} / {data.data?.global.n}
            </div>
            <div className="text-gray-500">그룹 다수결%</div>
            <div className="text-right">{data.data?.group.simple_pct ?? "–"}%</div>
            <div className="text-gray-500">전체 다수결%</div>
            <div className="text-right">{data.data?.global.simple_pct ?? "–"}%</div>
            <div className="text-gray-500">그룹 가중%</div>
            <div className="text-right">{data.data?.group.weighted_pct ?? "–"}%</div>
            <div className="text-gray-500">전체 가중%</div>
            <div className="text-right">{data.data?.global.weighted_pct ?? "–"}%</div>
          </div>
          <ul className="space-y-2 text-[11px] text-gray-300 leading-snug">
            {(data.data?.bullets ?? []).map((line) => (
              <li key={line.slice(0, 52)} className="flex gap-2">
                <span className="text-emerald-400 font-bold shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
