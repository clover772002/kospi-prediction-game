import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// SVG 일절 없음 — HTML div + 유니코드 화살표만 사용 (Satori 호환 최대 보장)
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 192, height: 192, borderRadius: 48, overflow: "hidden", background: "#FFFFFF" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#1A1A1A", width: "100%", height: 50 }}>
          <div style={{ color: "#FFFFFF", fontSize: 21, fontWeight: 900, letterSpacing: 6, fontFamily: "sans-serif" }}>KOSPI</div>
        </div>
        {/* 버튼 영역 */}
        <div style={{ display: "flex", flex: 1, alignItems: "flex-start", justifyContent: "center", gap: 12, paddingTop: 16, paddingLeft: 20, paddingRight: 20 }}>
          {/* 상승 버튼 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 66, height: 78, borderRadius: 12, background: "#C62828", border: "3.5px solid #111111", boxShadow: "5px 5px 0 #111111" }}>
            <div style={{ color: "#FFFFFF", fontSize: 40, fontWeight: 900, lineHeight: 1, marginTop: -4 }}>▲</div>
          </div>
          {/* 하락 버튼 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 66, height: 78, borderRadius: 12, background: "#1565C0", border: "3.5px solid #111111", boxShadow: "5px 5px 0 #111111" }}>
            <div style={{ color: "#FFFFFF", fontSize: 40, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>▼</div>
          </div>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
