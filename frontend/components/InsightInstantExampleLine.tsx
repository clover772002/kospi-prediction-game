/** 카드 헤더: 제목 바로 아래 예시 줄 — 등장 애니 + 은은한 반복 하이라이트(전환용). 접근성: reduced-motion 시 정적. */

export default function InsightInstantExampleLine({ text }: { text: string }) {
  return (
    <p className="insight-instant-example-line mt-1 max-w-xl text-[10px] leading-relaxed text-gray-500">
      <span className="insight-instant-example-line__pulse">{text}</span>
    </p>
  );
}
