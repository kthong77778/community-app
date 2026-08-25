import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/posts/:id — single post (with counts) plus its comments.
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const store = getStore();
  const user = await getCurrentUser();
  const post = await store.getPostView(id, user?.id ?? null);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  const comments = await store.listComments(id);
  return NextResponse.json({ post, comments });
}

// DELETE /api/posts/:id — author only.
export async function DELETE(_request: Request, { params }: Params) {
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
  if (post.authorId !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }
  await store.deletePost(id);
  return NextResponse.json({ ok: true });
}
