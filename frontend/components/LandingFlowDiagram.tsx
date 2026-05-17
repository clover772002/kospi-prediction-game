/** 로그인 랜딩: 두 단계 흐름을 그림으로만 보여 줌 (복잡한 설명 최소화) */
export default function LandingFlowDiagram() {
  return (
    <svg
      viewBox="0 0 340 168"
      className="mx-auto mb-6 sm:mb-8 w-full max-w-xl text-emerald-200/95"
      role="img"
      aria-label="1단계: 코스피 예측으로 토큰 받기 2단계: 토큰으로 고수와 소통"
    >
      <defs>
        <linearGradient id="landingFlowCard" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(255 251 235 / 0.12)" />
          <stop offset="100%" stopColor="rgb(15 23 42 / 0.6)" />
        </linearGradient>
        <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L0,10 L9,5 z" fill="#fbbf24" />
        </marker>
      </defs>

      {/* ① 코스피 → 토큰 */}
      <rect
        x="8"
        y="18"
        width="154"
        height="96"
        rx="16"
        fill="url(#landingFlowCard)"
        stroke="rgb(251 191 36 / 0.55)"
        strokeWidth="2.5"
      />
      <text x="85" y="48" textAnchor="middle" fill="rgb(253 224 171)" fontSize="24" fontWeight="800">
        ①
      </text>
      <text x="85" y="76" textAnchor="middle" fill="#fbbf24" fontSize="19" fontWeight="800">
        코스피
      </text>
      <text x="85" y="100" textAnchor="middle" fill="rgb(203 213 225)" fontSize="17" fontWeight="700">
        예측 → 토큰
      </text>
      <circle cx="50" cy="125" r="11" fill="rgb(239 68 68 / 0.35)" stroke="rgb(248 113 113 / 0.9)" strokeWidth="1.5" />
      <text x="50" y="131" textAnchor="middle" fill="#fecaca" fontSize="18" fontWeight="800">
        ↑
      </text>
      <circle cx="120" cy="125" r="11" fill="rgb(59 130 246 / 0.35)" stroke="rgb(96 165 250 / 0.95)" strokeWidth="1.5" />
      <text x="120" y="131" textAnchor="middle" fill="#bfdbfe" fontSize="18" fontWeight="800">
        ↓
      </text>

      {/* 화살표 → 우측 */}
      <path
        d="M 168 65 L 200 65"
        stroke="rgb(251 191 36 / 0.75)"
        strokeWidth="3"
        markerEnd="url(#arrowHead)"
      />

      {/* ② 고수 소통 */}
      <rect
        x="206"
        y="18"
        width="126"
        height="96"
        rx="16"
        fill="url(#landingFlowCard)"
        stroke="rgb(56 189 248 / 0.55)"
        strokeWidth="2.5"
      />
      <text x="269" y="48" textAnchor="middle" fill="rgb(186 230 253)" fontSize="24" fontWeight="800">
        ②
      </text>
      <text x="269" y="76" textAnchor="middle" fill="#67e8f9" fontSize="19" fontWeight="800">
        고수
      </text>
      <text x="269" y="100" textAnchor="middle" fill="rgb(203 213 225)" fontSize="16" fontWeight="700">
        토큰 소통
      </text>

      {/* 말풍선 간단 표현 */}
      <path
        d="M242 138 L298 138 L289 154 L279 154 Z"
        fill="rgb(30 58 138 / 0.45)"
        stroke="rgb(125 211 252 / 0.5)"
        strokeWidth="1.5"
      />
      <text x="267" y="152" textAnchor="middle" fill="rgb(226 232 240)" fontSize="14" fontWeight="700">
        질문
      </text>
    </svg>
  );
}
