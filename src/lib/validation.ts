// Small input-validation helpers shared by the API routes.

// Community post categories.
//  자랑 = 우리 아이 자랑 / 질문 = 궁금해요 / 후기 = 장소·용품 후기 / 홍보 = 가게·행사 홍보
export const POST_CATEGORIES = ["자랑", "질문", "후기", "홍보"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const DEFAULT_CATEGORY: PostCategory = "자랑";

export function normalizeCategory(value: unknown): PostCategory {
  return POST_CATEGORIES.includes(value as PostCategory)
    ? (value as PostCategory)
    : DEFAULT_CATEGORY;
}

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 20,
  passwordMin: 6,
  titleMax: 120,
  contentMax: 5000,
  commentMax: 1000,
  reviewMax: 500,
  itemTitleMax: 60,
  itemDescMax: 1000,
  locationMax: 40,
  priceMax: 100000000,
  messageMax: 1000,
};

export function validateUsername(value: unknown): string | null {
  if (typeof value !== "string") return "아이디를 입력해 주세요.";
  const v = value.trim();
  if (v.length < LIMITS.usernameMin || v.length > LIMITS.usernameMax) {
    return `아이디는 ${LIMITS.usernameMin}~${LIMITS.usernameMax}자여야 합니다.`;
  }
  if (!/^[a-zA-Z0-9_가-힣]+$/.test(v)) {
    return "아이디는 한글, 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.";
  }
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string") return "비밀번호를 입력해 주세요.";
  if (value.length < LIMITS.passwordMin) {
    return `비밀번호는 최소 ${LIMITS.passwordMin}자 이상이어야 합니다.`;
  }
  return null;
}

// Returns a trimmed string within [1, max], or null if invalid.
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v.length < 1 || v.length > max) return null;
  return v;
}
