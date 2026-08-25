import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST() {
  // Revokes the server-side session and clears the cookie.
  await endSession();
  return NextResponse.json({ ok: true });
}
