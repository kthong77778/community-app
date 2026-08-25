import { NextResponse } from "next/server";
import { hashPassword, setSessionCookie, toPublicUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { validatePassword, validateUsername } from "@/lib/validation";

export async function POST(request: Request) {
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

  const store = getStore();
  const existing = await store.getUserByUsername(username);
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다." },
      { status: 409 },
    );
  }

  const user = await store.createUser({
    username,
    passwordHash: hashPassword(password),
  });
  await setSessionCookie(user.id);

  return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
}
