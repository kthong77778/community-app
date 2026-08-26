"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { timeAgo } from "@/lib/format";
import { itemEmoji, statusStyle, won } from "@/lib/itemDisplay";
import { ITEM_STATUSES } from "@/lib/marketplace";
import type { Item } from "@/lib/store/types";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

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
          {isSeller && (
            <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }} onClick={remove}>
              삭제
            </button>
          )}
        </div>
        <h1>{item.title}</h1>
        <div className="item-price-lg">{won(item.price)}</div>
        <p className="muted" style={{ margin: "6px 0 14px" }}>
          {item.sellerName} · {item.location} · {timeAgo(item.createdAt)}
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

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() =>
            alert(`${item.sellerName}님과의 채팅\n\n실제 앱에서는 판매자와 1:1 채팅으로 연결됩니다.`)
          }
        >
          💬 채팅하기
        </button>
      </article>
    </>
  );
}
