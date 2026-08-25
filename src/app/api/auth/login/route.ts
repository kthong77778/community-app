import { NextResponse } from "next/server";
import { setSessionCookie, toPublicUser, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";

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

  const store = getStore();
  const user = await store.getUserByUsername(username);
  // Verify even when the user is missing to keep timing roughly constant.
  const ok = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ user: toPublicUser(user) });
}
