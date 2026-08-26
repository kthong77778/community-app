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
          <Link href="/map" className="btn btn-sm">
            🗺️ 지도
          </Link>
          <Link href="/items" className="btn btn-sm">
            🛒 중고거래
          </Link>
          <Link href="/shop" className="btn btn-sm">
            🛍️ 쇼핑
          </Link>
          {loading ? null : user ? (
            <>
              <span className="header-user">{user.username}님</span>
              <button className="btn btn-sm" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
