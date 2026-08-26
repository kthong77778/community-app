import Link from "next/link";
import { won } from "@/lib/itemDisplay";
import { PRODUCT_CATEGORIES, productEmoji } from "@/lib/shopping";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category: raw, sort: rawSort } = await searchParams;
  const category = PRODUCT_CATEGORIES.includes(raw as never) ? raw! : null;
  const sort = rawSort === "lowest" ? "lowest" : "latest";

  const products = await getStore().listProducts({ category, sort });

  // Preserve the active category when switching sort.
  const catQ = category ? `category=${encodeURIComponent(category)}&` : "";

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">쇼핑 · 가격비교</h1>
        <span className="count">{products.length}개</span>
      </div>

      <nav className="filters">
        <Link
          href="/shop"
          className={`filter-pill ${!category ? "active" : ""}`}
        >
          전체
        </Link>
        {PRODUCT_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/shop?category=${encodeURIComponent(c)}`}
            className={`filter-pill ${category === c ? "active" : ""}`}
          >
            {productEmoji(c)} {c}
          </Link>
        ))}
      </nav>

      <div className="sort-bar">
        <Link
          href={`/shop?${catQ}sort=latest`}
          className={`sort-pill ${sort === "latest" ? "active" : ""}`}
        >
          최신순
        </Link>
        <Link
          href={`/shop?${catQ}sort=lowest`}
          className={`sort-pill ${sort === "lowest" ? "active" : ""}`}
        >
          최저가순
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="empty">등록된 상품이 없어요.</div>
      ) : (
        <div className="item-grid">
          {products.map((p) => (
            <Link key={p.id} href={`/shop/${p.id}`} className="item-card">
              <div className="thumb-wrap">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="thumb" src={p.imageUrl} alt={p.name} />
                ) : (
                  <div className="thumb thumb-emoji">
                    {productEmoji(p.category)}
                  </div>
                )}
              </div>
              <div className="item-body">
                {p.brand && <div className="shop-brand">{p.brand}</div>}
                <div className="item-title">{p.name}</div>
                {p.offerCount > 0 ? (
                  <>
                    <div className="shop-price">
                      <span className="shop-price-label">최저</span>{" "}
                      {won(p.lowestPrice)}
                    </div>
                    <div className="shop-compare">🛍️ {p.offerCount}곳 비교</div>
                  </>
                ) : (
                  <div className="item-sub">가격정보 없음</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
