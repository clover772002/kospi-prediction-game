"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getWebPushEnvironment, isWebPushDeliveryReady, subscribeWebPush } from "@/lib/webPush";

type Props = {
  accessToken: string | null;
  hasPush: boolean;
  hasTelegram?: boolean;
  /** 단톡 / 고수 등 맥락 문구 */
  context?: "team-chat" | "general";
};

export default function PushConnectBanner({
  accessToken,
  hasPush,
  hasTelegram = false,
  context = "general",
}: Props) {
  const env = useMemo(() => getWebPushEnvironment(), []);
  const deliveryReady = isWebPushDeliveryReady(hasPush);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (deliveryReady || (hasTelegram && env.iosNeedsHomeScreen)) {
    return null;
  }

  const title =
    context === "team-chat"
      ? "단톡 알림이 안 올 수 있어요"
      : "알림이 이 기기에 안 올 수 있어요";

  let body: string;
  if (env.iosNeedsHomeScreen) {
    body = hasPush
      ? "다른 기기(PC 등)에서만 연동된 상태예요. iPhone은 Safari가 아니라 홈 화면에 추가한 앱을 열고, 설정에서 알림을 다시 켜 주세요."
      : "iPhone은 Safari 탭에서는 푸시가 막혀 있어요. 공유 → 홈 화면에 추가 후, 그 아이콘으로 들어가 알림을 허용해야 단톡 메시지가 옵니다.";
  } else if (!hasPush) {
    body = "설정에서 브라우저 알림을 연결하면 단톡·설문 알림을 받을 수 있어요.";
  } else {
    body = "알림 권한이 꺼졌거나 구독이 만료됐을 수 있어요. 설정에서 다시 연결해 주세요.";
  }

  const handleResubscribe = async () => {
    if (!accessToken || !env.canSubscribe) return;
    setLoading(true);
    setErr(null);
    try {
      await subscribeWebPush(accessToken);
      window.location.href = "/setup";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 mx-3 mt-2 shrink-0 rounded-xl border border-orange-500/35 bg-orange-950/40 px-3 py-2.5 text-xs text-orange-100">
      <p className="font-bold text-orange-200">{title}</p>
      <p className="mt-1 leading-relaxed text-orange-100/90">{body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href="/setup"
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-black"
        >
          {env.iosNeedsHomeScreen ? "홈 화면 추가 방법" : "알림 설정"}
        </Link>
        {env.canSubscribe && accessToken ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleResubscribe()}
            className="rounded-lg border border-orange-400/50 px-3 py-1.5 text-[11px] font-bold text-orange-200 disabled:opacity-50"
          >
            {loading ? "연결 중…" : "여기서 다시 연결"}
          </button>
        ) : null}
        {!hasTelegram ? (
          <Link
            href="/setup"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-gray-300"
          >
            텔레그램 알림
          </Link>
        ) : null}
      </div>
      {err ? <p className="mt-1.5 text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
