import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/places/:id — place with its reviews (newest first).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const store = getStore();
  const place = await store.getPlace(id);
  if (!place) {
    return NextResponse.json({ error: "장소를 찾을 수 없습니다." }, { status: 404 });
  }
  const reviews = await store.listReviews(id);
  return NextResponse.json({ place, reviews });
}
