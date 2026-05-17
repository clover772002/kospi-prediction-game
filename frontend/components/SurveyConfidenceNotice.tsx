/** 설문 게이지: 확신도 ≠ 코스피 등락률 예측 */
export default function SurveyConfidenceNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2.5 text-center">
        <p className="text-base font-black text-cyan-100 leading-snug">얼마나 확신하세요?</p>
        <p className="text-sm text-white/90 mt-1 leading-snug">
          숫자는 <strong className="text-amber-200">등락률이 아닙니다</strong>. 예:{" "}
          <span className="text-blue-300 font-bold">−5</span> = 코스피 5% 하락 예측 ❌ → 하락 방향{" "}
          <strong className="text-white">확신이 약함</strong> ✅
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-500/45 bg-gradient-to-b from-amber-500/15 to-amber-950/20 px-4 py-4 space-y-3">
      <p className="text-lg sm:text-xl font-black text-amber-100 text-center leading-snug">
        얼마나 확신하세요?
      </p>
      <p className="text-base text-white/95 text-center leading-relaxed">
        먼저 <strong className="text-red-400">상승</strong>·<strong className="text-blue-400">하락</strong> 방향을
        고르고, 그 방향에 대한 <strong className="text-white">확신 강도</strong>를 막대로 정합니다.
      </p>
      <div className="rounded-xl bg-[#0d0d0d]/80 border border-[#333] px-3 py-3 space-y-2 text-sm sm:text-base leading-relaxed">
        <p className="text-red-300/95">
          <span className="font-black">❌ 흔한 오해</span> — 「−5%」를 넣었다 = 코스피가 5% 빠질 거라고 본다
        </p>
        <p className="text-emerald-300/95">
          <span className="font-black">✅ 맞는 의미</span> — 「−5」= <strong className="text-white">하락</strong> 쪽으로
          보지만 확신은 약함 (막대를 더 왼쪽·오른쪽으로 옮기면 확신만 커짐)
        </p>
      </div>
      <p className="text-sm text-gray-400 text-center leading-snug">
        장 마감 <strong className="text-gray-300">등락률</strong>은 입력하지 않습니다. 결과는 대시보드 「실적」에서 확인해요.
      </p>
    </div>
  );
}
