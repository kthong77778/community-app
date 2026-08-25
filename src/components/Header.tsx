"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="inner">
        <Link href="/" className="brand">
          🐾 댕냥마을
        </Link>
        <div className="header-actions">
          {loading ? null : user ? (
            <>
              <span className="header-user">{user.username}님</span>
              <button className="btn btn-sm" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-sm">
                로그인
              </Link>
              <Link href="/register" className="btn btn-sm btn-primary">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
