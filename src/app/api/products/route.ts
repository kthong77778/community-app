import { NextResponse } from "next/server";
import {
  isProductSort,
  PRODUCT_CATEGORIES,
} from "@/lib/shopping";
import { getStore } from "@/lib/store";

// GET /api/products?category=&sort=lowest|latest — catalog products with
// price-comparison aggregates (offerCount, lowestPrice, highestPrice).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawCat = url.searchParams.get("category");
  const category =
    rawCat && PRODUCT_CATEGORIES.includes(rawCat as never) ? rawCat : null;
  const rawSort = url.searchParams.get("sort");
  const sort = isProductSort(rawSort) ? rawSort : "latest";

  const products = await getStore().listProducts({ category, sort });
  return NextResponse.json({ products });
}
