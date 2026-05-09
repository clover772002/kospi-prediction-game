import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 180, height: 180, borderRadius: 45, overflow: "hidden", background: "#FFFFFF" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#1A1A1A", width: "100%", height: 47 }}>
          <div style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 900, letterSpacing: 6, fontFamily: "sans-serif" }}>KOSPI</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "flex-start", justifyContent: "center", gap: 11, paddingTop: 15, paddingLeft: 19, paddingRight: 19 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 73, borderRadius: 11, background: "#C62828", border: "3px solid #111111", boxShadow: "5px 5px 0 #111111" }}>
            <div style={{ color: "#FFFFFF", fontSize: 38, fontWeight: 900, lineHeight: 1, marginTop: -4 }}>▲</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 73, borderRadius: 11, background: "#1565C0", border: "3px solid #111111", boxShadow: "5px 5px 0 #111111" }}>
            <div style={{ color: "#FFFFFF", fontSize: 38, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>▼</div>
          </div>
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
