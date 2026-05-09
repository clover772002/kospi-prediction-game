import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  const bg   = "#FFFFFF";
  const dark = "#1A1A1A";

  const HDR   = 50;
  const BTN_W = 66;
  const BTN_H = 78;
  const RX    = 12;
  const DEPTH = 5;
  const GAP   = 12;
  const L_X   = 20;
  const R_X   = L_X + BTN_W + GAP;    // 98
  const SVG_H = 192 - HDR;            // 142
  const BTN_Y = 16;

  const CTR_Y   = BTN_Y + Math.round(BTN_H / 2);
  const ARR_TOP = CTR_Y - 22;
  const ARR_MID = CTR_Y;
  const ARR_BOT = CTR_Y + 22;
  const L_CX    = L_X + Math.round(BTN_W / 2);
  const R_CX    = R_X + Math.round(BTN_W / 2);

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 192, height: 192, borderRadius: 48, overflow: "hidden", background: bg }}>
        {/* KOSPI 헤더 — HTML div (Satori SVG text 미지원) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: dark, width: "100%", height: HDR }}>
          <div style={{ color: bg, fontSize: 21, fontWeight: 900, letterSpacing: 6, fontFamily: "sans-serif" }}>KOSPI</div>
        </div>

        {/* 버튼 SVG — text 노드 없음, runtime=edge로 프리렌더 방지 */}
        <svg width="192" height={SVG_H} viewBox={`0 0 192 ${SVG_H}`} style={{ display: "block" }}>
          {/* 노이즈 점 */}
          {([[22,18],[55,10],[98,15],[148,12],[168,34],[178,90],[174,126],[32,128],[14,68]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.4" fill="#cccccc" opacity="0.5" />
          ))}

          {/* 왼쪽 버튼 그림자 */}
          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 왼쪽 버튼 */}
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="3" rx="1.5" fill="#ffffff" opacity="0.22" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="3" rx="1.5" fill="#000000" opacity="0.28" />
          {/* 위 화살표 */}
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+20},${ARR_MID} ${L_CX-20},${ARR_MID}`} fill={bg} />
          <rect x={L_CX-6} y={ARR_MID-2} width="12" height={ARR_BOT-ARR_MID+2} rx="2" fill={bg} />

          {/* 오른쪽 버튼 그림자 */}
          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 오른쪽 버튼 */}
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="3" rx="1.5" fill="#ffffff" opacity="0.18" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="3" rx="1.5" fill="#000000" opacity="0.28" />
          {/* 아래 화살표 */}
          <rect x={R_CX-6} y={ARR_TOP} width="12" height={ARR_MID-ARR_TOP+2} rx="2" fill={bg} />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+20},${ARR_MID} ${R_CX-20},${ARR_MID}`} fill={bg} />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
