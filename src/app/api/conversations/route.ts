import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

// GET /api/conversations — the current user's chat threads (newest activity first).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const conversations = await getStore().listConversations(user.id);
  return NextResponse.json({ conversations });
}

// POST /api/conversations { itemId } — start (or reopen) a chat with an item's
// seller. The current user is the buyer. Returns the conversation.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) {
    return NextResponse.json({ error: "상품 정보가 필요합니다." }, { status: 400 });
  }

  const item = await getStore().getItem(itemId);
  if (!item) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  if (item.sellerId === user.id) {
    return NextResponse.json(
      { error: "내 상품에는 채팅할 수 없어요." },
      { status: 400 },
    );
  }

  const conversation = await getStore().getOrCreateConversation({
    itemId,
    buyerId: user.id,
    sellerId: item.sellerId,
  });
  return NextResponse.json({ conversation }, { status: 201 });
}
