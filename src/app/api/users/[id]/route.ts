import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/users/:id — public profile: a user's posts and marketplace listings
// (newest first). Aggregates existing content by author/seller (id = username).
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const store = getStore();
  const [posts, items] = await Promise.all([
    store.listPostsByAuthor(id, viewer?.id ?? null),
    store.listItemsBySeller(id, viewer?.id ?? null),
  ]);
  return NextResponse.json({
    id,
    postCount: posts.length,
    itemCount: items.length,
    posts,
    items,
  });
}
