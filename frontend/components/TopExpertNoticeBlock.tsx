"use client";

import GlobalTopExpertBanner, { GlobalTopExpertDethronedBanner } from "@/components/GlobalTopExpertBanner";
import { useTopExpertNotice } from "@/lib/top-expert-notice";

type Props = {
  userId: string | null | undefined;
  isGlobalTopExpert: boolean | undefined;
  receivesToday?: boolean;
  compact?: boolean;
  expertChatUnlocked?: boolean;
};

/** 최고 고수 선정·박탈 안내 (로컬 저장으로 박탈 1회 표시) */
export default function TopExpertNoticeBlock({
  userId,
  isGlobalTopExpert,
  receivesToday = true,
  compact = false,
  expertChatUnlocked = true,
}: Props) {
  const notice = useTopExpertNotice(userId, isGlobalTopExpert);

  if (notice === "appointed") {
    return (
      <GlobalTopExpertBanner
        receivesToday={receivesToday}
        compact={compact}
        expertChatUnlocked={expertChatUnlocked}
      />
    );
  }
  if (notice === "dethroned") {
    return <GlobalTopExpertDethronedBanner compact={compact} />;
  }
  return null;
}
