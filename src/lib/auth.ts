import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { getAccount } from "./accounts";
import type { PublicUser } from "./store/types";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

// Accounts are hardcoded in accounts.json, so sessions do not need a database.
// A session is a stateless HMAC-signed token carrying the username. In
// production set AUTH_SECRET; the dev fallback keeps local login working.
const SECRET =
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me-in-production";

// ----- Signed token: base64url(`${username}.${expiresMs}`).hmac -----

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function createToken(username: string): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const encoded = Buffer.from(`${username}.${expires}`).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token: string): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const [username, expiresStr] = Buffer.from(encoded, "base64url")
    .toString("utf8")
    .split(".");
  const expires = Number(expiresStr);
  if (!username || !Number.isFinite(expires) || Date.now() > expires) {
    return null;
  }
  return username;
}

// Reads the token from the Authorization header (mobile) or cookie (web).
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

export interface AuthUser {
  id: string; // = username (accounts are keyed by username)
  username: string;
}

// Issues a session for the account: sets the web cookie and returns the token
// (for the mobile client to store and send as a Bearer header).
export async function issueSession(username: string): Promise<string> {
  const token = createToken(username);
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

// Clears the session cookie (logout). Stateless tokens can't be revoked
// server-side, but they expire; clearing the cookie logs the browser out.
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns the current account, or null. Works for cookie (web) and bearer
// (mobile). Returns null if the account was removed from accounts.json.
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await readToken();
  if (!token) return null;
  const username = verifyToken(token);
  if (!username) return null;
  const acc = getAccount(username);
  if (!acc) return null;
  return { id: acc.username, username: acc.username };
}

export function toPublicUser(user: AuthUser): PublicUser {
  return { id: user.id, username: user.username, createdAt: "" };
}
