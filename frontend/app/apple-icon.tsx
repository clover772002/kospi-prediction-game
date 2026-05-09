import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // 180×180 기준 (192 대비 ~0.9375 스케일)
  const S  = 180 / 192;
  const sc = (v: number) => Math.round(v * S);

  const BTN_W = sc(76), BTN_H = sc(88), BTN_Y = sc(76), RX = sc(14), DEPTH = sc(5);
  const L_X = sc(13), R_X = sc(99);
  const CTR_Y   = BTN_Y + Math.round(BTN_H / 2);
  const ARR_TOP = CTR_Y - sc(26);
  const ARR_MID = CTR_Y;
  const ARR_BOT = CTR_Y + sc(26);
  const L_CX = L_X + Math.round(BTN_W / 2);
  const R_CX = R_X + Math.round(BTN_W / 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          overflow: "hidden",
          background: "#E8E0D0",
          display: "flex",
          position: "relative",
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <rect width="180" height="180" fill="#E8E0D0" />

          {([[20,20],[52,13],[94,18],[145,16],[164,38],[174,94],[169,150],[131,171],[75,176],[28,167],[10,113],[13,56]] as number[][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.4" fill="#bbb0a0" opacity="0.5" />
          ))}

          <rect x="0" y="0" width="180" height={sc(52)} fill="#1A1A1A" />
          <text
            x="90" y={sc(35)}
            textAnchor="middle"
            fontFamily="Arial Black, Impact, Arial"
            fontWeight="900"
            fontSize={sc(24)}
            fill="#E8E0D0"
            letterSpacing="5"
          >KOSPI</text>

          {/* 왼쪽 버튼 */}
          <rect x={L_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill="#1A1A1A" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#C62828" />
          <rect x={L_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke="#1A1A1A" strokeWidth="3.5" />
          <rect x={L_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="rgba(255,255,255,0.22)" />
          <rect x={L_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="rgba(0,0,0,0.28)" />
          <polygon points={`${L_CX},${ARR_TOP} ${L_CX+sc(24)},${ARR_MID} ${L_CX-sc(24)},${ARR_MID}`} fill="#E8E0D0" />
          <rect x={L_CX-sc(7)} y={ARR_MID-2} width={sc(14)} height={ARR_BOT-ARR_MID+2} rx="2" fill="#E8E0D0" />

          {/* 오른쪽 버튼 */}
          <rect x={R_X+DEPTH} y={BTN_Y+DEPTH} width={BTN_W} height={BTN_H} rx={RX} fill="#1A1A1A" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="#0D47A1" />
          <rect x={R_X} y={BTN_Y} width={BTN_W} height={BTN_H} rx={RX} fill="none" stroke="#1A1A1A" strokeWidth="3.5" />
          <rect x={R_X+5} y={BTN_Y+5} width={BTN_W-10} height="4" rx="2" fill="rgba(255,255,255,0.18)" />
          <rect x={R_X+5} y={BTN_Y+BTN_H-9} width={BTN_W-10} height="4" rx="2" fill="rgba(0,0,0,0.28)" />
          <rect x={R_CX-sc(7)} y={ARR_TOP} width={sc(14)} height={ARR_MID-ARR_TOP+2} rx="2" fill="#E8E0D0" />
          <polygon points={`${R_CX},${ARR_BOT} ${R_CX+sc(24)},${ARR_MID} ${R_CX-sc(24)},${ARR_MID}`} fill="#E8E0D0" />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
