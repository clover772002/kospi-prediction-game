import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  // 버튼 레이아웃 상수
  const BTN_W = 76, BTN_H = 88, BTN_Y = 76, RX = 14, DEPTH = 5;
  const L_X = 13, R_X = 99;
  const CTR_Y   = BTN_Y + BTN_H / 2;       // 120
  const ARR_TOP = CTR_Y - 26;               // 94
  const ARR_MID = CTR_Y;                    // 120
  const ARR_BOT = CTR_Y + 26;               // 146
  const L_CX = L_X + BTN_W / 2;            // 51
  const R_CX = R_X + BTN_W / 2;            // 137

  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          borderRadius: 42,
          overflow: "hidden",
          background: "#E8E0D0",
          display: "flex",
          position: "relative",
        }}
      >
        <svg
          width="192"
          height="192"
          viewBox="0 0 192 192"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {/* 배경 */}
          <rect width="192" height="192" fill="#E8E0D0" />

          {/* 노이즈 점 */}
          {([[22,22],[55,14],[100,19],[155,17],[175,40],[185,100],[180,160],[140,182],[80,188],[30,178],[10,120],[14,60]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.5" fill="#bbb0a0" opacity="0.5" />
          ))}

          {/* KOSPI 헤더 */}
          <rect x="0" y="0" width="192" height="52" fill="#1A1A1A" />
          <text
            x="96" y="35"
            textAnchor="middle"
            fontFamily="Arial Black, Impact, Arial"
            fontWeight="900"
            fontSize="24"
            fill="#E8E0D0"
            letterSpacing="5"
          >KOSPI</text>

          {/* ── 왼쪽 버튼 (상승·빨강) ── */}
          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill="#1A1A1A" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke="#1A1A1A" strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="rgba(255,255,255,0.22)" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="rgba(0,0,0,0.28)" />
          {/* 위 화살표 — 삼각+사각 2px 겹쳐 틈 제거 */}
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+24},${ARR_MID} ${L_CX-24},${ARR_MID}`} fill="#E8E0D0" />
          <rect x={L_CX-7} y={ARR_MID-2} width="14" height={ARR_BOT-ARR_MID+2} rx="2" fill="#E8E0D0" />

          {/* ── 오른쪽 버튼 (하락·파랑) ── */}
          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill="#1A1A1A" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke="#1A1A1A" strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="rgba(0,0,0,0.28)" />
          {/* 아래 화살표 — 삼각+사각 2px 겹쳐 틈 제거 */}
          <rect x={R_CX-7} y={ARR_TOP} width="14" height={ARR_MID-ARR_TOP+2} rx="2" fill="#E8E0D0" />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+24},${ARR_MID} ${R_CX-24},${ARR_MID}`} fill="#E8E0D0" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
