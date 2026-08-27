"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CHAT_ENABLED } from "@/lib/features";
import { timeAgo } from "@/lib/format";
import { itemEmoji, statusStyle, won } from "@/lib/itemDisplay";
import type { ItemView, PostView } from "@/lib/store/types";

interface Profile {
  id: string;
  postCount: number;
  itemCount: number;
  posts: PostView[];
  items: ItemView[];
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [data, setData] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (res.ok) setData(await res.json());
    setStatus("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading" || !data) return <p className="muted">불러오는 중...</p>;

  const isMe = user?.id === data.id;

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="profile-head">
        <span className="profile-av">{data.id.slice(0, 1).toUpperCase()}</span>
        <div className="profile-meta">
          <h1 className="profile-name">{data.id}</h1>
          <div className="profile-stats">
            글 {data.postCount} · 판매 {data.itemCount}
          </div>
        </div>
        {isMe && (
          <button className="btn btn-sm" onClick={handleLogout}>
            로그아웃
          </button>
        )}
      </div>

      {isMe && (
        <div className="profile-shortcuts">
          <Link href="/items?favorited=1" className="btn btn-sm">
            ♥ 찜한 상품
          </Link>
          <Link href="/map?favorited=1" className="btn btn-sm">
            ♥ 찜한 곳
          </Link>
          {CHAT_ENABLED && (
            <Link href="/chats" className="btn btn-sm">
              💬 채팅
            </Link>
          )}
        </div>
      )}

      <h2 className="section-title">판매 상품 {data.itemCount}</h2>
      {data.items.length === 0 ? (
        <p className="muted" style={{ padding: "6px 0 16px" }}>
          등록한 상품이 없어요.
        </p>
      ) : (
        <div className="item-grid">
          {data.items.map((i) => {
            const st = statusStyle(i.status);
            return (
              <Link
                key={i.id}
                href={`/items/${i.id}`}
                className={`item-card ${i.status === "판매완료" ? "done" : ""}`}
              >
                <div className="thumb-wrap">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="thumb" src={i.imageUrl} alt={i.title} />
                  ) : (
                    <div className="thumb thumb-emoji">{itemEmoji(i.category)}</div>
                  )}
                  <span
                    className="st-badge"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {i.status}
                  </span>
                </div>
                <div className="item-body">
                  <div className="item-title">{i.title}</div>
                  <div className="item-price">{won(i.price)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="section-title">작성한 글 {data.postCount}</h2>
      {data.posts.length === 0 ? (
        <p className="muted" style={{ padding: "6px 0" }}>
          작성한 글이 없어요.
        </p>
      ) : (
        <div className="post-list">
          {data.posts.map((p) => (
            <Link key={p.id} href={`/posts/${p.id}`}>
              <article className="post-card">
                <div className="card-top">
                  <span className={`badge badge-${p.category}`}>{p.category}</span>
                  <h3>{p.title}</h3>
                </div>
                <p className="post-excerpt">{p.content}</p>
                <div className="post-meta">
                  <span>{timeAgo(p.createdAt)}</span>
                  <span className="meta-stat dot">♥ {p.likeCount}</span>
                  <span className="meta-stat">💬 {p.commentCount}</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
