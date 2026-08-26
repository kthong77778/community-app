"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { timeAgo } from "@/lib/format";
import { itemEmoji, statusStyle, won } from "@/lib/itemDisplay";
import { ITEM_STATUSES } from "@/lib/marketplace";
import type { ItemView } from "@/lib/store/types";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<ItemView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [favBusy, setFavBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/items/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    const data = await res.json();
    setItem(data.item);
    setStatus("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(next: string) {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setItem(data.item);
    }
  }

  async function toggleFavorite() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (favBusy || !item) return;
    setFavBusy(true);
    // Optimistic update; revert on failure.
    const prev = item;
    setItem({
      ...item,
      favoritedByMe: !item.favoritedByMe,
      favoriteCount: item.favoriteCount + (item.favoritedByMe ? -1 : 1),
    });
    try {
      const res = await fetch(`/api/items/${id}/favorite`, { method: "POST" });
      if (!res.ok) {
        setItem(prev);
      } else {
        const data = (await res.json()) as { favorited: boolean };
        setItem((cur) =>
          cur ? { ...cur, favoritedByMe: data.favorited } : cur,
        );
      }
    } catch {
      setItem(prev);
    } finally {
      setFavBusy(false);
    }
  }

  async function startChat() {
    if (!user) {
      router.push(`/login?next=/items/${id}`);
      return;
    }
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/chats/${data.conversation.id}`);
      else alert(data.error ?? "채팅을 시작할 수 없습니다.");
    } catch {
      alert("채팅을 시작할 수 없습니다.");
    }
  }

  async function remove() {
    if (!confirm("이 상품을 삭제할까요?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/items");
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "삭제에 실패했습니다.");
    }
  }

  if (status === "loading") return <p className="muted">불러오는 중...</p>;
  if (status === "notfound" || !item) {
    return (
      <div className="empty">
        상품을 찾을 수 없습니다.
        <br />
        <Link href="/items" className="btn btn-sm" style={{ marginTop: 12 }}>
          목록으로
        </Link>
      </div>
    );
  }

  const isSeller = user?.id === item.sellerId;
  const st = statusStyle(item.status);

  return (
    <>
      <Link href="/items" className="back-link">
        ← 목록으로
      </Link>

      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="item-hero" src={item.imageUrl} alt={item.title} />
      ) : (
        <div className="item-hero thumb-emoji">{itemEmoji(item.category)}</div>
      )}

      <article className="item-detail">
        <div className="item-detail-top">
          <span className="st-badge" style={{ background: st.bg, color: st.fg }}>
            {item.status}
          </span>
          <span className="badge cat-chip">
            {itemEmoji(item.category)} {item.category}
          </span>
          <button
            type="button"
            className={`fav-btn ${item.favoritedByMe ? "on" : ""}`}
            style={{ marginLeft: "auto" }}
            onClick={toggleFavorite}
            disabled={favBusy}
            aria-pressed={item.favoritedByMe}
            title={item.favoritedByMe ? "찜 취소" : "찜하기"}
          >
            <span className="fav-heart">{item.favoritedByMe ? "♥" : "♡"}</span>
            {item.favoriteCount > 0 && (
              <span className="fav-count">{item.favoriteCount}</span>
            )}
          </button>
          {isSeller && (
            <button className="btn btn-danger btn-sm" onClick={remove}>
              삭제
            </button>
          )}
        </div>
        <h1>{item.title}</h1>
        <div className="item-price-lg">{won(item.price)}</div>
        <p className="muted" style={{ margin: "6px 0 14px" }}>
          <Link
            href={`/users/${encodeURIComponent(item.sellerId)}`}
            className="author-link"
          >
            {item.sellerName}
          </Link>{" "}
          · {item.location} · {timeAgo(item.createdAt)}
        </p>

        {isSeller && (
          <div className="status-ctl">
            {ITEM_STATUSES.map((s) => (
              <button
                key={s}
                className={`st-opt ${item.status === s ? "on" : ""}`}
                onClick={() => changeStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <p className="item-desc">{item.description}</p>

        {!isSeller && (
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={startChat}
          >
            💬 채팅하기
          </button>
        )}
      </article>
    </>
  );
}
