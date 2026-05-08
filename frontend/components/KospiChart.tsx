"use client";

export default function KospiChart() {
  // URLSearchParams는 ':'을 %3A로 인코딩해 심볼 인식 실패 → 직접 문자열로 조합
  const src =
    "https://s.tradingview.com/widgetembed/?" +
    "symbol=KRX:069500" +       // KODEX200 (코스피200 추종 ETF)
    "&interval=60" +             // 1시간봉
    "&theme=dark" +
    "&style=2" +                 // 라인 차트
    "&locale=kr" +
    "&timezone=Asia%2FSeoul" +
    "&withdateranges=0" +
    "&hidesidetoolbar=1" +
    "&symboledit=0" +
    "&saveimage=0" +
    "&showpopupbutton=0" +
    "&hideideas=1" +
    "&hide_top_toolbar=1" +
    "&toolbarbg=0F0F0F" +
    "&bgcolor=0F0F0F";

  return (
    <div className="w-full overflow-hidden rounded-xl" style={{ height: 200 }}>
      <iframe
        src={src}
        width="100%"
        height="200"
        frameBorder="0"
        scrolling="no"
        allowTransparency
        style={{ display: "block", border: "none" }}
      />
    </div>
  );
}
