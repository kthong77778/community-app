import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getStore } from "./store";
import type { PublicUser, User } from "./store/types";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

// In production set AUTH_SECRET to a long random string. The dev fallback keeps
// local sessions working without configuration, but is not secret.
const SECRET =
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me-in-production";

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

// ----- Session tokens (HMAC-signed cookie value) -----
// Token format: base64url(payload).base64url(hmac)
// payload = `${userId}.${expiresAtMs}`

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${expires}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const [userId, expiresStr] = payload.split(".");
  const expires = Number(expiresStr);
  if (!userId || !Number.isFinite(expires) || Date.now() > expires) {
    return null;
  }
  return userId;
}

// ----- Cookie helpers (Next.js server) -----

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns the full User record for the current session, or null.
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  return getStore().getUserById(userId);
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}
