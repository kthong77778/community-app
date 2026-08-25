import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { cleanText, LIMITS } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// GET /api/posts/:id/comments — list comments (oldest first).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const comments = await getStore().listComments(id);
  return NextResponse.json({ comments });
}

// POST /api/posts/:id/comments — add a comment (requires login).
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const store = getStore();
  const post = await store.getPost(id);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const content = cleanText(body?.content, LIMITS.commentMax);
  if (!content) {
    return NextResponse.json(
      { error: `댓글을 1~${LIMITS.commentMax}자로 입력해 주세요.` },
      { status: 400 },
    );
  }

  const comment = await store.addComment({
    postId: id,
    content,
    authorId: user.id,
    authorName: user.username,
  });

  return NextResponse.json({ comment }, { status: 201 });
}
