import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness probe for uptime monitors and host health checks.
// Returns 200 quickly without touching the DB so a slow query can't mark the
// whole app down.
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
