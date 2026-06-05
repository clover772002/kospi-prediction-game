"use client";

import GaugeBar from "@/components/GaugeBar";
import { surveyUi } from "@/lib/survey-ui-tokens";

type Props = {
  direction: boolean | null;
  onDirectionSelect: (up: boolean) => void;
  onDirectionReset?: () => void;
  gaugeValue: number;
  onGaugeChange: (v: number) => void;
  userTokens: number;
  submitting: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void | Promise<void>;
  submitBtnClass?: string;
  confirmLabel?: string;
};

export default function SurveySimpleFlow({
  direction,
  onDirectionSelect,
  onDirectionReset,
  gaugeValue,
  onGaugeChange,
  userTokens,
  submitting,
  submitDisabled = false,
  onSubmit,
  submitBtnClass = "bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-gray-500 text-white",
  confirmLabel = "확정",
}: Props) {
  const locked = submitting || submitDisabled;

  if (direction === null) {
    return (
      <div className="grid grid-cols-2 gap-4 w-full min-w-0">
        <button
          type="button"
          onClick={() => onDirectionSelect(true)}
          disabled={locked}
          className="min-h-[7.5rem] sm:min-h-[8.5rem] rounded-2xl border-2 border-red-500/55 bg-red-500/15 text-red-300 text-2xl sm:text-3xl font-black transition-all active:scale-[0.98] hover:bg-red-500/25 disabled:opacity-45"
        >
          상승
        </button>
        <button
          type="button"
          onClick={() => onDirectionSelect(false)}
          disabled={locked}
          className="min-h-[7.5rem] sm:min-h-[8.5rem] rounded-2xl border-2 border-blue-500/55 bg-blue-500/15 text-blue-300 text-2xl sm:text-3xl font-black transition-all active:scale-[0.98] hover:bg-blue-500/25 disabled:opacity-45"
        >
          하락
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <div className="flex items-center justify-center gap-3">
        <p
          className={`text-2xl sm:text-3xl font-black ${
            direction ? "text-red-400" : "text-blue-400"
          }`}
        >
          {direction ? "상승" : "하락"}
        </p>
        {onDirectionReset && !locked ? (
          <button
            type="button"
            onClick={onDirectionReset}
            className="text-sm font-bold text-gray-500 hover:text-gray-300 underline underline-offset-2"
          >
            변경
          </button>
        ) : null}
      </div>

      <p className="text-center text-xl sm:text-2xl font-black text-white">얼마나 확신하나요?</p>

      <GaugeBar
        value={gaugeValue}
        onChange={onGaugeChange}
        tokens={userTokens}
        disabled={locked}
        lockDirection
        beginnerTips={false}
      />

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={locked || gaugeValue === 0}
        className={`${surveyUi.btnPrimary} ${submitBtnClass}`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            제출 중...
          </span>
        ) : (
          confirmLabel
        )}
      </button>
    </div>
  );
}
