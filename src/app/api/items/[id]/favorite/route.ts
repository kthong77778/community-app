import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// POST /api/items/:id/favorite — toggle the current user's 찜(favorite).
// Requires login. Returns { favorited } or 404 when the item is missing.
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const state = await getStore().toggleItemFavorite(user.id, id);
  if (!state) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(state);
}
