/** 카드 헤더: 제목(스냅샷 이름) 바로 아래에 붙는 짧은 예시 한 줄 */

export default function InsightInstantExampleLine({ text }: { text: string }) {
  return <p className="text-[10px] leading-relaxed text-gray-500 mt-1 max-w-xl">{text}</p>;
}
