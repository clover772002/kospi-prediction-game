/** 로딩·로그인 화면에 띄울 서비스 목적 안내 (무작위) */

export type LoadingPurposeTip = {
  id: string;
  emoji: string;
  text: string;
};

export const LOADING_PURPOSE_TIPS: LoadingPurposeTip[] = [
  { id: "survey", emoji: "📝", text: "매일 설문에 참여하고 코스피 방향을 맞혀 보세요" },
  { id: "tokens", emoji: "💰", text: "설문을 하면 토큰을 받아요" },
  { id: "tokens_hit", emoji: "🎯", text: "맞출수록 토큰이 더 쌓여요" },
  { id: "expert", emoji: "⭐", text: "토큰으로 초고수에게 질문을 보낼 수 있어요" },
  { id: "expert_reply", emoji: "💬", text: "초고수 답장으로 시장 인사이트를 얻어요" },
  { id: "dashboard", emoji: "📊", text: "대시보드에서 적중률·순위를 확인해요" },
  { id: "team_chat", emoji: "🗨️", text: "소통방에서 상승·하락 팀끼리 오늘 이야기를 나눠요" },
  { id: "gauge", emoji: "📈", text: "집단지성 게이지로 오늘 시장 분위기를 봐요" },
  { id: "expert_tab", emoji: "🔓", text: "토큰 210개 이상이면 명예의 전당이 열려요" },
  { id: "group", emoji: "👥", text: "그룹을 만들고 친구와 함께 예측해요" },
  { id: "notify", emoji: "🔔", text: "알림을 켜두면 설문 시간을 놓치지 않아요" },
  { id: "weight", emoji: "⚖️", text: "적중률이 높을수록 내 의견이 더 반영돼요" },
  { id: "night", emoji: "🌙", text: "밤 22시 설문 · 아침 마감 · 장 마감 후 결과" },
  { id: "pick", emoji: "✨", text: "고수 선택픽으로 오늘 방향을 참고할 수 있어요" },
  { id: "challenge", emoji: "⚔️", text: "친구와 1:1 대결로 적중률을 겨뤄 보세요" },
];

export function pickRandomTip(excludeIds: string[] = []): LoadingPurposeTip {
  const pool = LOADING_PURPOSE_TIPS.filter((t) => !excludeIds.includes(t.id));
  const list = pool.length > 0 ? pool : LOADING_PURPOSE_TIPS;
  return list[Math.floor(Math.random() * list.length)]!;
}
