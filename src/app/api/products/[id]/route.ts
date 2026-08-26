import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/products/:id — product with its offers (cheapest first).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const store = getStore();
  const product = await store.getProduct(id);
  if (!product) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  const offers = await store.listOffers(id);
  return NextResponse.json({ product, offers });
}
