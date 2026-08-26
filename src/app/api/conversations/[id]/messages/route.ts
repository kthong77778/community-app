import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { cleanText, LIMITS } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// POST /api/conversations/:id/messages { text } — send a message to a thread
// the current user takes part in.
export async function POST(request: Request, { params }: Params) {
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

  const body = await request.json().catch(() => null);
  const text = cleanText(body?.text, LIMITS.messageMax);
  if (!text) {
    return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  }

  const message = await store.sendMessage({
    conversationId: id,
    senderId: user.id,
    text,
  });
  return NextResponse.json({ message }, { status: 201 });
}
