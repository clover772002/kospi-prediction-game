import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  const bg   = "#E8E0D0";
  const dark = "#1A1A1A";

  // SVG 버튼 영역은 헤더(52px) 아래 140px 공간
  // 원래 좌표에서 -52 오프셋
  const BTN_W = 76, BTN_H = 88, RX = 14, DEPTH = 5;
  const L_X = 13, R_X = 99;
  const BTN_Y = 24;                         // 76 - 52
  const CTR_Y   = BTN_Y + BTN_H / 2;       // 68
  const ARR_TOP = CTR_Y - 26;              // 42
  const ARR_MID = CTR_Y;                   // 68
  const ARR_BOT = CTR_Y + 26;             // 94
  const L_CX = L_X + BTN_W / 2;           // 51
  const R_CX = R_X + BTN_W / 2;           // 137

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 192,
          height: 192,
          borderRadius: 42,
          overflow: "hidden",
          background: bg,
        }}
      >
        {/* KOSPI 헤더 — HTML div (SVG text 미사용) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: dark,
            width: "100%",
            height: 52,
          }}
        >
          <div
            style={{
              color: bg,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 5,
              fontFamily: "sans-serif",
            }}
          >
            KOSPI
          </div>
        </div>

        {/* 버튼 SVG 영역 — <text> 노드 없음 */}
        <svg
          width="192"
          height="140"
          viewBox="0 0 192 140"
          style={{ display: "block" }}
        >
          {/* 노이즈 점 */}
          {([[20,18],[53,10],[98,15],[153,13],[173,36],[183,96],[178,130],[31,130],[12,70]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.4" fill="#bbb0a0" opacity="0.5" />
          ))}

          {/* 왼쪽 버튼 그림자 */}
          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 왼쪽 버튼 본체 */}
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="#ffffff" opacity="0.22" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="#000000" opacity="0.28" />
          {/* 위 화살표 (2px 겹침으로 틈 제거) */}
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+24},${ARR_MID} ${L_CX-24},${ARR_MID}`} fill={bg} />
          <rect x={L_CX-7} y={ARR_MID-2} width="14" height={ARR_BOT-ARR_MID+2} rx="2" fill={bg} />

          {/* 오른쪽 버튼 그림자 */}
          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 오른쪽 버튼 본체 */}
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="#ffffff" opacity="0.18" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="#000000" opacity="0.28" />
          {/* 아래 화살표 (2px 겹침으로 틈 제거) */}
          <rect x={R_CX-7} y={ARR_TOP} width="14" height={ARR_MID-ARR_TOP+2} rx="2" fill={bg} />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+24},${ARR_MID} ${R_CX-24},${ARR_MID}`} fill={bg} />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
