import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// POST /api/items/:id/hide { hidden } — admin hides/unhides a listing.
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!isAdmin(user.username)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const hidden = body?.hidden === true;
  const ok = await getStore().setItemHidden(id, hidden);
  if (!ok) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ hidden });
}
