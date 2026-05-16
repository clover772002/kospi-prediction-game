"use client";

import InsightCardsStack, { InsightsInView, InsightCardsStackSkeleton } from "@/components/InsightCardsStack";
import { InsightDashboardCompactProvider } from "@/contexts/InsightDashboardCompactContext";
import { useInsightSurveyDatePicker } from "@/hooks/useInsightSurveyDatePicker";

export { InsightCardsStackSkeleton as DashboardInsightSectionSkeleton } from "@/components/InsightCardsStack";

export default function DashboardInsightSection({
  accessToken,
  onBalanceUpdated,
}: {
  accessToken: string;
  onBalanceUpdated?: () => void;
}) {
  const { selectedDate: surveyDate } = useInsightSurveyDatePicker(accessToken);

  if (!surveyDate) return null;

  return (
    <InsightDashboardCompactProvider>
      <InsightsInView fallback={<InsightCardsStackSkeleton />}>
        <InsightCardsStack
          accessToken={accessToken}
          surveyDate={surveyDate}
          hideUnlockControl
          onBalanceUpdated={onBalanceUpdated}
        />
      </InsightsInView>
    </InsightDashboardCompactProvider>
  );
}
