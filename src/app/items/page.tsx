import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { itemEmoji, statusStyle, won } from "@/lib/itemDisplay";
import { ITEM_CATEGORIES } from "@/lib/marketplace";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: raw } = await searchParams;
  const category = ITEM_CATEGORIES.includes(raw as never) ? raw! : null;

  const items = await getStore().listItems({ category });

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">중고거래</h1>
        <Link href="/sell" className="btn btn-primary btn-sm">
          팔기
        </Link>
      </div>

      <nav className="filters">
        <Link href="/items" className={`filter-pill ${!category ? "active" : ""}`}>
          전체
        </Link>
        {ITEM_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/items?category=${encodeURIComponent(c)}`}
            className={`filter-pill ${category === c ? "active" : ""}`}
          >
            {c}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="empty">
          등록된 상품이 없어요.
          <br />첫 상품을 올려보세요!
        </div>
      ) : (
        <div className="item-grid">
          {items.map((i) => {
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
                  <div className="item-sub">
                    {i.location} · {timeAgo(i.createdAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
