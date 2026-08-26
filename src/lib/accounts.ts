import { timingSafeEqual } from "crypto";
import accountsData from "./accounts.json";

// 하드코딩된 로그인 계정 (회원가입 없음). 계정은 accounts.json에서 관리합니다.
export interface Account {
  username: string;
  password: string;
}

const ACCOUNTS: Account[] = accountsData as Account[];

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare a fixed-length hash so length differences don't short-circuit the
  // timing-safe comparison.
  if (ab.length !== bb.length) {
    // Still run a comparison to keep timing roughly constant.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// Returns the matching account when the id/password are correct, else null.
export function verifyCredentials(
  username: string,
  password: string,
): Account | null {
  const acc = ACCOUNTS.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!acc) return null;
  return safeEqual(acc.password, password) ? acc : null;
}

// Looks up an account by username (used to resolve a session token).
export function getAccount(username: string): Account | null {
  return (
    ACCOUNTS.find(
      (a) => a.username.toLowerCase() === username.toLowerCase(),
    ) ?? null
  );
}
