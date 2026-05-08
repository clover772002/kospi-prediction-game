import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 38,
          background: "linear-gradient(135deg, #1e3a5f 0%, #0d1b2e 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, marginBottom: 5 }}>
          {[55, 92, 68, 106, 82].map((h, i) => (
            <div
              key={i}
              style={{
                width: 15,
                height: h * 0.5,
                borderRadius: 4,
                background: i === 3 ? "#3b82f6" : i === 1 ? "#60a5fa" : "#1d4ed8",
              }}
            />
          ))}
        </div>
        <div
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: -0.5,
          }}
        >
          코스피
        </div>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
