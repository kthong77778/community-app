import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

// GET /api/admin/reports — the admin inbox: all reports, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.username)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const reports = await getStore().listReports();
  return NextResponse.json({ reports });
}
