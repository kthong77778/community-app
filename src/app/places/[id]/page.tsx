"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { timeAgo } from "@/lib/format";
import { mapLinks } from "@/lib/mapLinks";
import { placeTypeInfo } from "@/lib/placeTypes";
import type { PlaceView, Review } from "@/lib/store/types";

function starStr(n: number): string {
  const r = Math.round(n);
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [place, setPlace] = useState<PlaceView | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/places/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    const data = await res.json();
    setPlace(data.place);
    setReviews(data.reviews ?? []);
    setStatus("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFavorite() {
    if (!user) {
      router.push(`/login?next=/places/${id}`);
      return;
    }
    if (favBusy || !place) return;
    setFavBusy(true);
    // Optimistic update; revert on failure.
    const prev = place;
    setPlace({
      ...place,
      favoritedByMe: !place.favoritedByMe,
      favoriteCount: place.favoriteCount + (place.favoritedByMe ? -1 : 1),
    });
    try {
      const res = await fetch(`/api/places/${id}/favorite`, { method: "POST" });
      if (!res.ok) {
        setPlace(prev);
      } else {
        const data = (await res.json()) as { favorited: boolean };
        setPlace((cur) =>
          cur ? { ...cur, favoritedByMe: data.favorited } : cur,
        );
      }
    } catch {
      setPlace(prev);
    } finally {
      setFavBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "리뷰 등록에 실패했습니다.");
        return;
      }
      setText("");
      setRating(5);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return <p className="muted">불러오는 중...</p>;
  if (status === "notfound" || !place) {
    return (
      <div className="empty">
        장소를 찾을 수 없습니다.
        <br />
        <Link href="/map" className="btn btn-sm" style={{ marginTop: 12 }}>
          지도로
        </Link>
      </div>
    );
  }

  const ti = placeTypeInfo(place.type);
  const links = mapLinks(place.name, place.lat, place.lng);

  return (
    <>
      <Link href="/map" className="back-link">
        ← 지도로
      </Link>

      <article className="post-detail">
        <div
          className="place-ic"
          style={{ background: `${ti.color}22`, color: ti.color, width: 54, height: 54, fontSize: 26, marginBottom: 12 }}
        >
          {ti.emoji}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span className="badge" style={{ background: `${ti.color}22`, color: ti.color }}>
            {ti.emoji} {place.type}
          </span>
          <button
            type="button"
            className={`fav-btn ${place.favoritedByMe ? "on" : ""}`}
            style={{ marginLeft: "auto" }}
            onClick={toggleFavorite}
            disabled={favBusy}
            aria-pressed={place.favoritedByMe}
            title={place.favoritedByMe ? "찜 취소" : "찜하기"}
          >
            <span className="fav-heart">{place.favoritedByMe ? "♥" : "♡"}</span>
            {place.favoriteCount > 0 && (
              <span className="fav-count">{place.favoriteCount}</span>
            )}
          </button>
        </div>
        <h1>{place.name}</h1>
        <p className="place-addr">📍 {place.address}</p>
        {place.reviewCount > 0 ? (
          <div className="rating-big">
            <span className="num">{place.avgRating.toFixed(1)}</span>
            <span className="st">{starStr(place.avgRating)}</span>
            <span className="cnt">리뷰 {place.reviewCount}개</span>
          </div>
        ) : (
          <p className="muted">아직 리뷰가 없어요</p>
        )}

        <div className="dir-links">
          {links.map((l) => (
            <a
              key={l.key}
              className="mapbtn"
              href={l.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="mapdot" style={{ background: l.color }} />
              {l.label}
            </a>
          ))}
        </div>
      </article>

      <h2 className="section-title">리뷰 {reviews.length}</h2>

      {user ? (
        <form className="review-form" onSubmit={submit}>
          {error && <div className="alert">{error}</div>}
          <div className="star-pick">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`star ${n <= rating ? "on" : ""}`}
                onClick={() => setRating(n)}
                aria-label={`${n}점`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="방문 후기를 남겨주세요"
            style={{ minHeight: 84 }}
          />
          <div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !text.trim()}
            >
              {submitting ? "등록 중..." : "리뷰 등록"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">
          리뷰를 남기려면 <Link href={`/login?next=/places/${id}`}>로그인</Link>하세요.
        </p>
      )}

      <div>
        {reviews.length === 0 ? (
          <p className="muted" style={{ padding: "16px 0" }}>
            아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!
          </p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="review">
              <div className="rv-head">
                <span className="rv-name">{r.authorName}</span>
                <span className="rv-stars">{starStr(r.rating)}</span>
              </div>
              <div className="rv-time">{timeAgo(r.createdAt)}</div>
              <div className="rv-body">{r.text}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
