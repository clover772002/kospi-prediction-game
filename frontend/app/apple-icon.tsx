import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bg   = "#E8E0D0";
  const dark = "#1A1A1A";
  const S    = 180 / 192;
  const sc   = (v: number) => Math.round(v * S);

  const BTN_W = sc(76), BTN_H = sc(88), RX = sc(14), DEPTH = sc(5);
  const L_X = sc(13), R_X = sc(99);
  const BTN_Y   = sc(24);
  const CTR_Y   = BTN_Y + Math.round(BTN_H / 2);
  const ARR_TOP = CTR_Y - sc(26);
  const ARR_MID = CTR_Y;
  const ARR_BOT = CTR_Y + sc(26);
  const L_CX = L_X + Math.round(BTN_W / 2);
  const R_CX = R_X + Math.round(BTN_W / 2);
  const HDR = sc(52);
  const SVG_H = 180 - HDR;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 180,
          height: 180,
          borderRadius: 40,
          overflow: "hidden",
          background: bg,
        }}
      >
        {/* KOSPI 헤더 — HTML div */}
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
          <div
            style={{
              color: bg,
              fontSize: sc(22),
              fontWeight: 900,
              letterSpacing: 5,
              fontFamily: "sans-serif",
            }}
          >
            KOSPI
          </div>
        </div>

        {/* 버튼 SVG — <text> 노드 없음 */}
        <svg
          width="180"
          height={SVG_H}
          viewBox={`0 0 180 ${SVG_H}`}
          style={{ display: "block" }}
        >
          {/* 노이즈 점 */}
          {([[18,16],[50,9],[92,14],[144,12],[163,34],[172,90],[167,122],[29,122],[11,66]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.3" fill="#bbb0a0" opacity="0.5" />
          ))}

          {/* 왼쪽 버튼 그림자 */}
          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 왼쪽 버튼 본체 */}
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="#ffffff" opacity="0.22" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="4" rx="2" fill="#000000" opacity="0.28" />
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+sc(24)},${ARR_MID} ${L_CX-sc(24)},${ARR_MID}`} fill={bg} />
          <rect x={L_CX-sc(7)} y={ARR_MID-2} width={sc(14)} height={ARR_BOT-ARR_MID+2} rx="2" fill={bg} />

          {/* 오른쪽 버튼 그림자 */}
          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill={dark} />
          {/* 오른쪽 버튼 본체 */}
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke={dark} strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="#ffffff" opacity="0.18" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-8} width={BTN_W-10} height="4" rx="2" fill="#000000" opacity="0.28" />
          <rect x={R_CX-sc(7)} y={ARR_TOP} width={sc(14)} height={ARR_MID-ARR_TOP+2} rx="2" fill={bg} />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+sc(24)},${ARR_MID} ${R_CX-sc(24)},${ARR_MID}`} fill={bg} />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
