"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { won } from "@/lib/itemDisplay";
import type { ConversationView, Message } from "@/lib/store/types";

export default function ChatRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();

  const [convo, setConvo] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setConvo(data.conversation);
      setMessages(data.messages);
      setStatus("ready");
    }
  }, [id]);

  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user, load]);

  // Poll for new messages while the thread is open (also marks it read server-side).
  // Only swap the array when the count changed, so the scroll effect stays quiet.
  useEffect(() => {
    if (loading || !user) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setMessages((prev) =>
          prev.length === data.messages.length ? prev : data.messages,
        );
      } catch {
        // ignore transient errors
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [id, loading, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, data.message]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  if (loading || status === "loading") return <p className="muted">불러오는 중...</p>;

  if (!user) {
    return (
      <div className="empty">
        로그인이 필요해요.
        <br />
        <Link href="/login" className="btn btn-sm" style={{ marginTop: 12 }}>
          로그인
        </Link>
      </div>
    );
  }

  if (status === "notfound" || !convo) {
    return (
      <div className="empty">
        대화를 찾을 수 없습니다.
        <br />
        <Link href="/chats" className="btn btn-sm" style={{ marginTop: 12 }}>
          채팅 목록
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/chats" className="back-link">
        ← 채팅 목록
      </Link>

      <div className="chatroom-head">
        <div className="chat-with">{convo.otherUserId}님과의 대화</div>
        {convo.itemId && (
          <Link href={`/items/${convo.itemId}`} className="chat-item-banner">
            <span className="chat-item-thumb">
              {convo.itemImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={convo.itemImageUrl} alt="" />
              ) : (
                "📦"
              )}
            </span>
            <span className="chat-item-info">
              <span className="chat-item-title">
                {convo.itemTitle ?? "삭제된 상품"}
              </span>
              {convo.itemPrice != null && (
                <span className="chat-item-price">{won(convo.itemPrice)}</span>
              )}
            </span>
          </Link>
        )}
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>
            첫 메시지를 보내보세요.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`msg-row ${m.senderId === user.id ? "mine" : "other"}`}
            >
              <div className="bubble">{m.text}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form className="msg-form" onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="메시지를 입력하세요"
          autoComplete="off"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={sending || !text.trim()}
        >
          전송
        </button>
      </form>
    </>
  );
}
