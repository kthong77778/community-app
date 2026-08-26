import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { PLACE_TYPES } from "@/lib/store/seed-places";

// GET /api/places?type=카페&favorited=1 — list places (optionally filtered) with
// rating + favorite aggregates. With favorited=1 returns the current user's
// 찜 목록 (empty when logged out). Each place carries favoritedByMe/favoriteCount.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const type =
    rawType && PLACE_TYPES.includes(rawType as never) ? rawType : null;

  const user = await getCurrentUser();

  if (url.searchParams.get("favorited") === "1") {
    if (!user) return NextResponse.json({ places: [] });
    const places = await getStore().listFavoritePlaces(user.id);
    return NextResponse.json({ places });
  }

  const places = await getStore().listPlaces(type, user?.id ?? null);
  return NextResponse.json({ places });
}
