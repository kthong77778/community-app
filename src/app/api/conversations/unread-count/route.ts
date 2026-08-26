import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

// GET /api/conversations/unread-count — total unread messages for a nav badge.
// Returns { count: 0 } when logged out so clients can poll unconditionally.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });
  const count = await getStore().getTotalUnread(user.id);
  return NextResponse.json({ count });
}
