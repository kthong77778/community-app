"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { itemEmoji } from "@/lib/itemDisplay";
import { ITEM_CATEGORIES } from "@/lib/marketplace";

export default function SellPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("기타");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/sell");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          price: Math.round(Number(price)),
          category,
          location,
          imageUrl,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      router.push(`/items/${data.item.id}`);
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
      <Link href="/items" className="back-link">
        ← 목록으로
      </Link>
      <h1 className="page-title">상품 등록</h1>
      <div className="form-card">
        {error && <div className="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>카테고리</label>
            <div className="cat-select">
              {ITEM_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`cat-option ${category === c ? "on" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {itemEmoji(c)} {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="t">상품명</label>
            <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="상품명" required />
          </div>
          <div className="field">
            <label htmlFor="p">가격 (원)</label>
            <input id="p" className="input" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 15000" required />
          </div>
          <div className="field">
            <label htmlFor="l">거래 지역</label>
            <input id="l" className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={40} placeholder="예: 서울 마포구" required />
          </div>
          <div className="field">
            <label htmlFor="img">사진 URL (선택)</label>
            <input id="img" className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... (없으면 비워두세요)" />
          </div>
          <div className="field">
            <label htmlFor="d">설명</label>
            <textarea id="d" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="상품 상태, 거래 방법 등을 적어주세요" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "등록 중..." : "등록"}
            </button>
            <Link href="/items" className="btn">
              취소
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
