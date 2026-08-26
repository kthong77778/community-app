import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { itemEmoji, statusStyle, won } from "@/lib/itemDisplay";
import { ITEM_CATEGORIES } from "@/lib/marketplace";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; favorited?: string }>;
}) {
  const { category: raw, favorited: favRaw } = await searchParams;
  const category = ITEM_CATEGORIES.includes(raw as never) ? raw! : null;
  const favoritedOnly = favRaw === "1";

  const user = await getCurrentUser();
  const store = getStore();
  const items =
    favoritedOnly && user
      ? await store.listFavoriteItems(user.id)
      : favoritedOnly
        ? []
        : await store.listItems({ category, currentUserId: user?.id ?? null });

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">중고거래</h1>
        <Link href="/sell" className="btn btn-primary btn-sm">
          팔기
        </Link>
      </div>

      <nav className="filters">
        <Link
          href="/items"
          className={`filter-pill ${!category && !favoritedOnly ? "active" : ""}`}
        >
          전체
        </Link>
        {ITEM_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/items?category=${encodeURIComponent(c)}`}
            className={`filter-pill ${!favoritedOnly && category === c ? "active" : ""}`}
          >
            {c}
          </Link>
        ))}
        <Link
          href="/items?favorited=1"
          className={`filter-pill ${favoritedOnly ? "active" : ""}`}
        >
          ♥ 찜한 상품
        </Link>
      </nav>

      {favoritedOnly && !user ? (
        <div className="empty">
          찜한 상품을 보려면 로그인이 필요해요.
          <br />
          <Link href="/login" className="btn btn-sm" style={{ marginTop: 12 }}>
            로그인
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          {favoritedOnly ? (
            <>
              아직 찜한 상품이 없어요.
              <br />
              마음에 드는 상품에 ♥를 눌러보세요!
            </>
          ) : (
            <>
              등록된 상품이 없어요.
              <br />첫 상품을 올려보세요!
            </>
          )}
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
                  {i.favoritedByMe && (
                    <span className="fav-badge" aria-label="찜한 상품">
                      ♥
                    </span>
                  )}
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
