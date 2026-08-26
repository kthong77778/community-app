// 지도 장소 유형 표시 정보 (웹).
export const PLACE_TYPE_INFO: Record<string, { emoji: string; color: string }> = {
  카페: { emoji: "☕", color: "#f59e0b" },
  샵: { emoji: "🛍️", color: "#ec4899" },
  호텔: { emoji: "🛏️", color: "#0ea5e9" },
  병원: { emoji: "🏥", color: "#10b981" },
};

export function placeTypeInfo(type: string) {
  return PLACE_TYPE_INFO[type] ?? { emoji: "📍", color: "#8c7b6c" };
}
