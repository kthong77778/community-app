import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies, headers } from "next/headers";
import { getStore } from "./store";
import type { PublicUser, User } from "./store/types";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds), matches the store's TTL

// ----- Password hashing (scrypt) -----

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ----- Sessions -----
// Tokens are opaque random strings created and stored server-side (see the
// Store). They carry no signature and no user data, so there is no secret to
// leak and a token can be revoked at logout. Web reads it from an httpOnly
// cookie; mobile sends it as `Authorization: Bearer <token>`.

// Reads the token from the Authorization header (mobile) or the cookie (web).
async function readToken(): Promise<string | null> {
  const headerList = await headers();
  const auth = headerList.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

// Creates a session for the user, sets the web cookie, and returns the token
// (for the mobile client to store).
export async function issueSession(userId: string): Promise<string> {
  const token = await getStore().createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return token;
}

// Revokes the current session (logout) and clears the cookie.
export async function endSession(): Promise<void> {
  const token = await readToken();
  if (token) await getStore().deleteSession(token);
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns the User for the current request, or null. Works for cookie (web) and
// bearer-token (mobile) auth.
export async function getCurrentUser(): Promise<User | null> {
  const token = await readToken();
  if (!token) return null;
  return getStore().getSessionUser(token);
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}
