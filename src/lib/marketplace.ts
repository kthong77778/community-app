// 중고거래 카테고리 / 상태 상수.
export const ITEM_CATEGORIES = [
  "사료/간식",
  "장난감",
  "의류",
  "이동장/하우스",
  "기타",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_STATUSES = ["판매중", "예약중", "판매완료"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const DEFAULT_ITEM_CATEGORY: ItemCategory = "기타";
export const DEFAULT_ITEM_STATUS: ItemStatus = "판매중";

export function normalizeItemCategory(value: unknown): ItemCategory {
  return ITEM_CATEGORIES.includes(value as ItemCategory)
    ? (value as ItemCategory)
    : DEFAULT_ITEM_CATEGORY;
}

export function isItemStatus(value: unknown): value is ItemStatus {
  return ITEM_STATUSES.includes(value as ItemStatus);
}
