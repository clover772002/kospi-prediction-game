/** 잠금된 대시보드 집계 카드에서 — 사용자를 아이템 탭 유료 잠금 해제로 안내 */
export default function InsightUnlockShopHint() {
  return (
    <p className="text-[10px] text-amber-400/90 mt-1.5 leading-relaxed">
      아래 탭 <strong className="text-amber-200">아이템</strong>에서 표시된 토큰으로 잠금 해제할 수 있어요. 거래일을 고른 뒤 같은 이름의 아이템에서 해제해 주세요.
    </p>
  );
}
