import { NextResponse } from "next/server";
import { hashPassword, issueSession, toPublicUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { getStore } from "@/lib/store";
import { validatePassword, validateUsername } from "@/lib/validation";

export async function POST(request: Request) {
  // Throttle sign-ups per IP (10 / 10 min) to limit abuse.
  const ip = await clientIp();
  const rl = rateLimit(`register:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  // createUser is atomic: it returns null if the username is already taken,
  // with no check-then-insert race.
  const user = await getStore().createUser({
    username,
    passwordHash: hashPassword(password),
  });
  if (!user) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다." },
      { status: 409 },
    );
  }

  const token = await issueSession(user.id);
  return NextResponse.json(
    { user: toPublicUser(user), token },
    { status: 201 },
  );
}
