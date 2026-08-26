"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { won } from "@/lib/itemDisplay";
import { productEmoji } from "@/lib/shopping";
import type { Offer, ProductView } from "@/lib/store/types";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<ProductView | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

  const load = useCallback(async () => {
    const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    const data = await res.json();
    setProduct(data.product);
    setOffers(data.offers ?? []);
    setStatus("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") return <p className="muted">불러오는 중...</p>;
  if (status === "notfound" || !product) {
    return (
      <div className="empty">
        상품을 찾을 수 없습니다.
        <br />
        <Link href="/shop" className="btn btn-sm" style={{ marginTop: 12 }}>
          쇼핑으로
        </Link>
      </div>
    );
  }

  const save = product.highestPrice - product.lowestPrice;

  return (
    <>
      <Link href="/shop" className="back-link">
        ← 쇼핑으로
      </Link>

      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="item-hero" src={product.imageUrl} alt={product.name} />
      ) : (
        <div className="item-hero thumb-emoji">{productEmoji(product.category)}</div>
      )}

      <article className="item-detail">
        <div className="item-detail-top">
          <span className="badge cat-chip">
            {productEmoji(product.category)} {product.category}
          </span>
          {product.brand && <span className="badge">{product.brand}</span>}
        </div>
        <h1>{product.name}</h1>

        {product.offerCount > 0 ? (
          <div className="shop-price-lg">
            <span className="shop-price-label">최저가</span> {won(product.lowestPrice)}
            <span className="shop-among"> · {product.offerCount}곳 비교</span>
          </div>
        ) : (
          <p className="muted">아직 등록된 판매처가 없어요.</p>
        )}

        {product.description && <p className="item-desc">{product.description}</p>}
      </article>

      <h2 className="section-title">판매처 {offers.length}곳</h2>

      {offers.length === 0 ? (
        <p className="muted" style={{ padding: "16px 0" }}>
          아직 등록된 판매처가 없어요.
        </p>
      ) : (
        <div className="offer-list">
          {offers.map((o, i) => (
            <div key={o.id} className={`offer-row ${i === 0 ? "best" : ""}`}>
              <div className="offer-main">
                <div className="offer-shop">
                  {o.shop}
                  {i === 0 && <span className="offer-best">최저가</span>}
                </div>
                <div className="offer-price">{won(o.price)}</div>
              </div>
              {o.url ? (
                <a
                  className="btn btn-primary btn-sm"
                  href={o.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  구매하러 가기
                </a>
              ) : (
                <span className="muted">링크 없음</span>
              )}
            </div>
          ))}
          {save > 0 && (
            <p className="offer-save">
              최고가 대비 최대 <b>{won(save)}</b> 절약할 수 있어요.
            </p>
          )}
        </div>
      )}
    </>
  );
}
