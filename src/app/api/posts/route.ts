import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import {
  cleanText,
  LIMITS,
  normalizeCategory,
  POST_CATEGORIES,
} from "@/lib/validation";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /api/posts?limit=20&offset=0 — paginated feed (newest first).
// Returns { posts, hasMore, nextOffset }.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);

  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  // Optional category filter; ignored unless it is a known category.
  const rawCategory = url.searchParams.get("category");
  const category =
    rawCategory && POST_CATEGORIES.includes(rawCategory as never)
      ? rawCategory
      : null;

  const page = await getStore().listPostViews({
    limit,
    offset,
    currentUserId: user?.id ?? null,
    category,
  });
  return NextResponse.json(page);
}

// POST /api/posts — create a post (requires login).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = cleanText(body?.title, LIMITS.titleMax);
  const content = cleanText(body?.content, LIMITS.contentMax);
  if (!title) {
    return NextResponse.json(
      { error: `제목을 1~${LIMITS.titleMax}자로 입력해 주세요.` },
      { status: 400 },
    );
  }
  if (!content) {
    return NextResponse.json(
      { error: `내용을 1~${LIMITS.contentMax}자로 입력해 주세요.` },
      { status: 400 },
    );
  }

  const post = await getStore().createPost({
    title,
    content,
    category: normalizeCategory(body?.category),
    authorId: user.id,
    authorName: user.username,
  });

  return NextResponse.json({ post }, { status: 201 });
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
