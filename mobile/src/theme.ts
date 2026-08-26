// 댕냥마을 — 따뜻하고 친근한 반려동물 커뮤니티 톤.
export const colors = {
  bg: "#fbf6f0",
  surface: "#ffffff",
  surface2: "#fdf7f1",
  border: "#eee1d4",
  text: "#2c241d",
  textMuted: "#8c7b6c",
  primary: "#ea5c33", // 따뜻한 코랄 (버튼: 흰 볼드 텍스트)
  primaryText: "#ffffff",
  primarySoft: "#fdeadf",
  primaryStrong: "#c2410c", // 작은 텍스트/링크용 진한 톤
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  like: "#e11d48",
  likeBg: "#fff1f2",
};

export const radius = 14;

// 커뮤니티 카테고리 + 배지 색.
export const CATEGORIES = ["자랑", "질문", "후기", "홍보"] as const;
export type Category = (typeof CATEGORIES)[number];

export const categoryStyle: Record<string, { fg: string; bg: string }> = {
  자랑: { fg: "#b45309", bg: "#fef3c7" },
  질문: { fg: "#1d4ed8", bg: "#dbeafe" },
  후기: { fg: "#047857", bg: "#d1fae5" },
  홍보: { fg: "#be185d", bg: "#fce7f3" },
};

export function catStyle(cat: string) {
  return categoryStyle[cat] ?? { fg: colors.textMuted, bg: colors.surface2 };
}

// 지도 장소 유형.
export const PLACE_TYPES = [
  { key: "카페", emoji: "☕", color: "#f59e0b" },
  { key: "샵", emoji: "🛍️", color: "#ec4899" },
  { key: "호텔", emoji: "🛏️", color: "#0ea5e9" },
  { key: "병원", emoji: "🏥", color: "#10b981" },
] as const;

export function placeType(key: string) {
  return PLACE_TYPES.find((t) => t.key === key) ?? PLACE_TYPES[0];
}

// 중고거래 카테고리 / 상태.
export const ITEM_CATEGORIES = ["사료/간식", "장난감", "의류", "이동장/하우스", "기타"] as const;
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

export const ITEM_STATUSES = ["판매중", "예약중", "판매완료"] as const;
export const itemStatusStyle: Record<string, { fg: string; bg: string }> = {
  "판매중": { fg: "#047857", bg: "#d1fae5" },
  "예약중": { fg: "#b45309", bg: "#fef3c7" },
  "판매완료": { fg: "#6b7280", bg: "#e5e7eb" },
};
export function statusStyle(st: string) {
  return itemStatusStyle[st] ?? itemStatusStyle["판매중"];
}

export function won(n: number): string {
  return (n || 0).toLocaleString("ko-KR") + "원";
}

