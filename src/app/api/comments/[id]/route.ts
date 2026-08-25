import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/comments/:id — author only.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const store = getStore();
  const comment = await store.getCommentById(id);
  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (comment.authorId !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await store.deleteComment(id);
  return NextResponse.json({ ok: true });
}
