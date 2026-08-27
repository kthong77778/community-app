import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { LIMITS } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// POST /api/posts/:id/report { reason? } — report a post (any logged-in user).
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
  const reason =
    typeof body?.reason === "string"
      ? body.reason.slice(0, LIMITS.reportReasonMax).trim()
      : "";
  await store.addReport({
    targetType: "post",
    targetId: id,
    reporterId: user.id,
    reason,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
