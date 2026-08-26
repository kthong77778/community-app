import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// POST /api/places/:id/favorite — toggle the current user's 찜(즐겨찾기).
// Requires login. Returns { favorited } or 404 when the place is missing.
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const state = await getStore().togglePlaceFavorite(user.id, id);
  if (!state) {
    return NextResponse.json({ error: "장소를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(state);
}
