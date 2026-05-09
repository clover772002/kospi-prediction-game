import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bg   = "#E8E0D0";
  const dark = "#1A1A1A";
  const S    = 180 / 192;
  const sc   = (v: number) => Math.round(v * S);

  const HDR   = sc(50);
  const BTN_W = sc(66);
  const BTN_H = sc(78);
  const RX    = sc(12);
  const DEPTH = sc(5);
  const GAP   = sc(12);
  const L_X   = sc(20);
  const R_X   = L_X + BTN_W + GAP;
  const SVG_H = 180 - HDR;
  const BTN_Y = Math.round((SVG_H - BTN_H - DEPTH) / 2);

  const CTR_Y   = BTN_Y + Math.round(BTN_H / 2);
  const ARR_TOP = CTR_Y - sc(22);
  const ARR_MID = CTR_Y;
  const ARR_BOT = CTR_Y + sc(22);
  const L_CX    = L_X + Math.round(BTN_W / 2);
  const R_CX    = R_X + Math.round(BTN_W / 2);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 180,
          height: 180,
          borderRadius: 45,
          overflow: "hidden",
          background: bg,
        }}
      >
        {/* KOSPI 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: dark,
            width: "100%",
            height: HDR,
          }}
        >
          <div style={{ color: bg, fontSize: sc(21), fontWeight: 900, letterSpacing: 5, fontFamily: "sans-serif" }}>
            KOSPI
          </div>
        </div>

        {/* 버튼 SVG */}
        <svg width="180" height={SVG_H} viewBox={`0 0 180 ${SVG_H}`} style={{ display: "block" }}>
          {([[20,16],[52,9],[92,14],[140,11],[158,32],[167,84],[163,118],[30,120],[13,64]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.3" fill="#bbb0a0" opacity="0.5" />
          ))}

          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="3" rx="1.5" fill="#ffffff" opacity="0.22" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="3" rx="1.5" fill="#000000" opacity="0.28" />
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+sc(20)},${ARR_MID} ${L_CX-sc(20)},${ARR_MID}`} fill={bg} />
          <rect x={L_CX-sc(6)} y={ARR_MID-2} width={sc(12)} height={ARR_BOT-ARR_MID+2} rx="2" fill={bg} />

          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="3" rx="1.5" fill="#ffffff" opacity="0.18" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="3" rx="1.5" fill="#000000" opacity="0.28" />
          <rect x={R_CX-sc(6)} y={ARR_TOP} width={sc(12)} height={ARR_MID-ARR_TOP+2} rx="2" fill={bg} />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+sc(20)},${ARR_MID} ${R_CX-sc(20)},${ARR_MID}`} fill={bg} />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
