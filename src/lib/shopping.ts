// 쇼핑/물품 비교 카테고리 · 정렬 상수 + 표시 헬퍼 (웹).

export const PRODUCT_CATEGORIES = [
  "사료",
  "간식",
  "영양제",
  "장난감",
  "미용/위생",
  "용품",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = "용품";

export function normalizeProductCategory(value: unknown): ProductCategory {
  return PRODUCT_CATEGORIES.includes(value as ProductCategory)
    ? (value as ProductCategory)
    : DEFAULT_PRODUCT_CATEGORY;
}

// 정렬: 최저가순(lowest) / 최신순(latest)
export const PRODUCT_SORTS = ["lowest", "latest"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export function isProductSort(value: unknown): value is ProductSort {
  return PRODUCT_SORTS.includes(value as ProductSort);
}

const PRODUCT_EMOJI: Record<string, string> = {
  사료: "🍖",
  간식: "🦴",
  영양제: "💊",
  장난감: "🧸",
  "미용/위생": "🧼",
  용품: "🎒",
};

export function productEmoji(category: string): string {
  return PRODUCT_EMOJI[category] ?? "🛍️";
}
