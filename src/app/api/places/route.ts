import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { PLACE_TYPES } from "@/lib/store/seed-places";

// GET /api/places?type=카페 — list places (optionally filtered) with rating aggregates.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const type =
    rawType && PLACE_TYPES.includes(rawType as never) ? rawType : null;

  const places = await getStore().listPlaces(type);
  return NextResponse.json({ places });
}
