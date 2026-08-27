"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CHAT_ENABLED } from "@/lib/features";
import { timeAgo } from "@/lib/format";
import type { ConversationView } from "@/lib/store/types";

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const [convos, setConvos] = useState<ConversationView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setConvos(data.conversations);
    }
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (!CHAT_ENABLED || loading) return;
    if (!user) {
      setStatus("ready");
      return;
    }
    void load();
    const iv = setInterval(() => void load(), 5000); // 실시간 갱신
    return () => clearInterval(iv);
  }, [loading, user, load]);

  if (!CHAT_ENABLED) {
    return (
      <div className="empty">
        채팅은 준비 중이에요.
        <br />곧 만나요! 🐾
      </div>
    );
  }

  if (loading || status === "loading") return <p className="muted">불러오는 중...</p>;

  if (!user) {
    return (
      <div className="empty">
        채팅을 보려면 로그인이 필요해요.
        <br />
        <Link href="/login?next=/chats" className="btn btn-sm" style={{ marginTop: 12 }}>
          로그인
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">채팅</h1>
        <span className="count">{convos.length}개</span>
      </div>

      {convos.length === 0 ? (
        <div className="empty">
          아직 대화가 없어요.
          <br />
          관심 있는 상품에서 채팅을 시작해보세요.
        </div>
      ) : (
        <div className="chat-list">
          {convos.map((c) => (
            <Link
              key={c.id}
              href={`/chats/${c.id}`}
              className={`chat-row ${c.unreadCount > 0 ? "unread" : ""}`}
            >
              <span className="chat-thumb">
                {c.itemImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.itemImageUrl} alt="" />
                ) : (
                  <span className="chat-thumb-emoji">🐾</span>
                )}
              </span>
              <span className="chat-main">
                <span className="chat-top">
                  <span className="chat-name">{c.otherUserId}</span>
                  {c.lastMessageText && (
                    <span className="chat-time">{timeAgo(c.lastMessageAt)}</span>
                  )}
                </span>
                <span className="chat-item-name">{c.itemTitle ?? "삭제된 상품"}</span>
                <span className="chat-last">
                  {c.lastMessageText ?? "대화를 시작해보세요"}
                </span>
              </span>
              {c.unreadCount > 0 && (
                <span className="chat-unread">
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
