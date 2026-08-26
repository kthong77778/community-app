import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isItemStatus } from "@/lib/marketplace";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/items/:id — listing detail (carries favoritedByMe for the viewer).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  const item = await getStore().getItem(id, user?.id ?? null);
  if (!item) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ item });
}

// PATCH /api/items/:id — update status (seller only).
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const store = getStore();
  const item = await store.getItem(id);
  if (!item) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  if (item.sellerId !== user.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isItemStatus(body?.status)) {
    return NextResponse.json({ error: "올바른 상태가 아닙니다." }, { status: 400 });
  }

  const updated = await store.updateItemStatus(id, body.status);
  return NextResponse.json({ item: updated });
}

// DELETE /api/items/:id — seller only.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const store = getStore();
  const item = await store.getItem(id);
  if (!item) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  if (item.sellerId !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }
  await store.deleteItem(id);
  return NextResponse.json({ ok: true });
}
