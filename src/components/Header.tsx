"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Poll the unread total so the 채팅 link shows a live badge.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/conversations/unread-count", {
          cache: "no-store",
        });
        if (res.ok && alive) setUnread((await res.json()).count);
      } catch {
        // ignore transient errors
      }
    };
    void fetchCount();
    const iv = setInterval(fetchCount, 20000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [user]);

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
              <Link href="/chats" className="btn btn-sm chat-link">
                💬 채팅
                {unread > 0 && (
                  <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>
                )}
              </Link>
              <Link
                href={`/users/${encodeURIComponent(user.username)}`}
                className="header-user"
              >
                {user.username}님
              </Link>
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
