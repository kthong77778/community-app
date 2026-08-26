import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/places/:id — place (with the viewer's 찜 state) and its reviews.
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const store = getStore();
  const user = await getCurrentUser();
  const place = await store.getPlace(id, user?.id ?? null);
  if (!place) {
    return NextResponse.json({ error: "장소를 찾을 수 없습니다." }, { status: 404 });
  }
  const reviews = await store.listReviews(id);
  return NextResponse.json({ place, reviews });
}
