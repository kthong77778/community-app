// 중고거래 표시용 (웹): 카테고리 이모지, 상태 색, 금액 포맷.
const ITEM_CAT_EMOJI: Record<string, string> = {
  "사료/간식": "🦴",
  "장난감": "🧸",
  "의류": "🧥",
  "이동장/하우스": "🏠",
  "기타": "📦",
};

export function itemEmoji(cat: string): string {
  return ITEM_CAT_EMOJI[cat] ?? "📦";
}

export const ITEM_STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  "판매중": { fg: "#047857", bg: "#d1fae5" },
  "예약중": { fg: "#b45309", bg: "#fef3c7" },
  "판매완료": { fg: "#6b7280", bg: "#e5e7eb" },
};

export function statusStyle(st: string) {
  return ITEM_STATUS_STYLE[st] ?? ITEM_STATUS_STYLE["판매중"];
}

export function won(n: number): string {
  return (n || 0).toLocaleString("ko-KR") + "원";
}
