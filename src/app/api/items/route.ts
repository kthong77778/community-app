import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  normalizeItemCategory,
} from "@/lib/marketplace";
import { getStore } from "@/lib/store";
import { cleanText, LIMITS } from "@/lib/validation";

// GET /api/items?category=&status= — list listings (newest first).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawCat = url.searchParams.get("category");
  const rawStatus = url.searchParams.get("status");
  const category =
    rawCat && ITEM_CATEGORIES.includes(rawCat as never) ? rawCat : null;
  const status =
    rawStatus && ITEM_STATUSES.includes(rawStatus as never) ? rawStatus : null;

  const items = await getStore().listItems({ category, status });
  return NextResponse.json({ items });
}

// POST /api/items — create a listing (requires login).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = cleanText(body?.title, LIMITS.itemTitleMax);
  const description = cleanText(body?.description, LIMITS.itemDescMax);
  const location = cleanText(body?.location, LIMITS.locationMax);
  const price = Math.round(Number(body?.price));
  const imageUrl =
    typeof body?.imageUrl === "string" ? body.imageUrl.slice(0, 2048) : "";

  if (!title) {
    return NextResponse.json({ error: "상품명을 입력해 주세요." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0 || price > LIMITS.priceMax) {
    return NextResponse.json({ error: "가격을 올바르게 입력해 주세요." }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "거래 지역을 입력해 주세요." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "상품 설명을 입력해 주세요." }, { status: 400 });
  }

  const item = await getStore().createItem({
    title,
    description,
    price,
    category: normalizeItemCategory(body?.category),
    imageUrl,
    location,
    sellerId: user.id,
    sellerName: user.username,
  });
  return NextResponse.json({ item }, { status: 201 });
}
