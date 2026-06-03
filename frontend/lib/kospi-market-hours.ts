/** KST 기준 코스피 정규장(09:00~15:35) — 이 구간에만 장중 시세 표시 */
export function isKospiMarketSessionOpenKST(now: Date = new Date()): boolean {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const mins = kst.getHours() * 60 + kst.getMinutes();
  return mins >= 9 * 60 && mins < 15 * 60 + 35;
}
