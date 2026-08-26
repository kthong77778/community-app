import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/:id — a thread (with messages) the user takes part in.
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const store = getStore();
  const conversation = await store.getConversationForUser(id, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "대화를 찾을 수 없습니다." }, { status: 404 });
  }
  const messages = await store.listMessages(id);
  return NextResponse.json({ conversation, messages });
}
