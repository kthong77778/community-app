import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listPostViews, toPostView } from "@/lib/posts";
import { getStore } from "@/lib/store";
import { cleanText, LIMITS } from "@/lib/validation";

// GET /api/posts — list all posts (newest first).
export async function GET() {
  const user = await getCurrentUser();
  const posts = await listPostViews(user?.id ?? null);
  return NextResponse.json({ posts });
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
    authorId: user.id,
    authorName: user.username,
  });

  return NextResponse.json({ post: toPostView(post, 0, user.id) }, { status: 201 });
}
