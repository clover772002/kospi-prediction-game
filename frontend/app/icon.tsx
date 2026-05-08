import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          borderRadius: 40,
          background: "linear-gradient(135deg, #1e3a5f 0%, #0d1b2e 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {/* 차트 막대 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 6 }}>
          {[60, 100, 75, 115, 90].map((h, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: h * 0.55,
                borderRadius: 4,
                background: i === 3 ? "#3b82f6" : i === 1 ? "#60a5fa" : "#1d4ed8",
              }}
            />
          ))}
        </div>
        {/* 텍스트 */}
        <div
          style={{
            color: "white",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -0.5,
          }}
        >
          코스피
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
