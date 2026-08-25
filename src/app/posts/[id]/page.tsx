"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { timeAgo } from "@/lib/format";
import type { Comment, PostView } from "@/lib/store/types";
import { LIMITS } from "@/lib/validation";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<PostView | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    "loading",
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/posts/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    const data = await res.json();
    setPost(data.post);
    setComments(data.comments ?? []);
    setStatus("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!user) {
      router.push(`/login?next=/posts/${id}`);
      return;
    }
    if (!post) return;
    // Optimistic update.
    const prev = post;
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    });
    const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
    if (!res.ok) {
      setPost(prev); // revert
      return;
    }
    const data = await res.json();
    setPost((p) =>
      p ? { ...p, likeCount: data.likeCount, likedByMe: data.likedByMe } : p,
    );
  }

  async function deletePost() {
    if (!confirm("이 게시글을 삭제할까요?")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "삭제에 실패했습니다.");
    }
  }

  if (status === "loading") {
    return <p className="muted">불러오는 중...</p>;
  }
  if (status === "notfound" || !post) {
    return (
      <div className="empty">
        게시글을 찾을 수 없습니다.
        <br />
        <Link href="/" className="btn btn-sm" style={{ marginTop: 12 }}>
          목록으로
        </Link>
      </div>
    );
  }

  const isAuthor = user?.id === post.authorId;

  return (
    <>
      <Link href="/" className="back-link">
        ← 목록으로
      </Link>

      <article className="post-detail">
        <h1>{post.title}</h1>
        <div className="post-meta">
          <span>{post.authorName}</span>
          <span className="dot">{timeAgo(post.createdAt)}</span>
          {isAuthor && (
            <button
              className="btn btn-danger btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={deletePost}
            >
              삭제
            </button>
          )}
        </div>

        <p className="post-body">{post.content}</p>

        <button
          className={`like-btn ${post.likedByMe ? "liked" : ""}`}
          onClick={toggleLike}
        >
          ♥ 좋아요 {post.likeCount}
        </button>
      </article>

      <CommentSection
        postId={id}
        comments={comments}
        currentUserId={user?.id ?? null}
        onChanged={load}
      />
    </>
  );
}

function CommentSection({
  postId,
  comments,
  currentUserId,
  onChanged,
}: {
  postId: string;
  comments: Comment[];
  currentUserId: string | null;
  onChanged: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "댓글 등록에 실패했습니다.");
        return;
      }
      setContent("");
      await onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(commentId: string) {
    if (!confirm("댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) {
      await onChanged();
    } else {
      const data = await res.json();
      alert(data.error ?? "삭제에 실패했습니다.");
    }
  }

  return (
    <section>
      <h2 className="section-title">댓글 {comments.length}</h2>

      {currentUserId ? (
        <form className="comment-form" onSubmit={submit}>
          {error && <div className="alert">{error}</div>}
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={LIMITS.commentMax}
            placeholder="댓글을 입력하세요"
          />
          <div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !content.trim()}
            >
              {submitting ? "등록 중..." : "댓글 등록"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">
          댓글을 남기려면 <Link href={`/login?next=/posts/${postId}`}>로그인</Link>
          하세요.
        </p>
      )}

      <div>
        {comments.length === 0 ? (
          <p className="muted" style={{ padding: "16px 0" }}>
            아직 댓글이 없습니다.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-head">
                <span>
                  <span className="comment-author">{c.authorName}</span>
                  {" · "}
                  {timeAgo(c.createdAt)}
                </span>
                {currentUserId === c.authorId && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(c.id)}
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="comment-body">{c.content}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
