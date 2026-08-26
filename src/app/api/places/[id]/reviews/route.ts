import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { cleanText, LIMITS } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// GET /api/places/:id/reviews — list reviews (newest first).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const reviews = await getStore().listReviews(id);
  return NextResponse.json({ reviews });
}

// POST /api/places/:id/reviews — add a review (requires login).
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const store = getStore();
  const place = await store.getPlace(id);
  if (!place) {
    return NextResponse.json({ error: "장소를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const rating = Math.round(Number(body?.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "별점을 1~5 사이로 선택해 주세요." },
      { status: 400 },
    );
  }
  const text = cleanText(body?.text, LIMITS.reviewMax);
  if (!text) {
    return NextResponse.json(
      { error: `리뷰를 1~${LIMITS.reviewMax}자로 입력해 주세요.` },
      { status: 400 },
    );
  }

  const review = await store.addReview({
    placeId: id,
    authorId: user.id,
    authorName: user.username,
    rating,
    text,
  });
  return NextResponse.json({ review }, { status: 201 });
}
