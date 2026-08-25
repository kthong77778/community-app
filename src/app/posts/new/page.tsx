"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LIMITS } from "@/lib/validation";

export default function NewPostPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect to login if not authenticated.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/posts/new");
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "글 등록에 실패했습니다.");
        return;
      }
      router.push(`/posts/${data.post.id}`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <>
      <Link href="/" className="back-link">
        ← 목록으로
      </Link>
      <h1 className="page-title">글쓰기</h1>
      <div className="form-card">
        {error && <div className="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">제목</label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.titleMax}
              placeholder="제목을 입력하세요"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="content">내용</label>
            <textarea
              id="content"
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={LIMITS.contentMax}
              placeholder="내용을 입력하세요"
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
            <Link href="/" className="btn">
              취소
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
