import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/accounts";
import { issueSession, toPublicUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  // Throttle login attempts per IP+username to slow brute-force (5 / 5 min).
  const ip = await clientIp();
  const rl = rateLimit(`login:${ip}:${username.toLowerCase()}`, 5, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Credentials are checked against the hardcoded accounts.json.
  const account = verifyCredentials(username, password);
  if (!account) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = await issueSession(account.username);
  return NextResponse.json({
    user: toPublicUser({ id: account.username, username: account.username }),
    token,
  });
}
