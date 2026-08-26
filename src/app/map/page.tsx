import Link from "next/link";
import { PlacesMap } from "@/components/PlacesMap";
import { getCurrentUser } from "@/lib/auth";
import { placeTypeInfo } from "@/lib/placeTypes";
import { getStore } from "@/lib/store";
import { PLACE_TYPES } from "@/lib/store/seed-places";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; favorited?: string }>;
}) {
  const { type: raw, favorited: favRaw } = await searchParams;
  const type = PLACE_TYPES.includes(raw as never) ? raw! : null;
  const favoritedOnly = favRaw === "1";

  const user = await getCurrentUser();
  const store = getStore();
  const places =
    favoritedOnly && user
      ? await store.listFavoritePlaces(user.id)
      : favoritedOnly
        ? []
        : await store.listPlaces(type, user?.id ?? null);
  const mapPlaces = places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    color: placeTypeInfo(p.type).color,
  }));

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">동네 지도</h1>
        <span className="count">{places.length}곳</span>
      </div>

      <nav className="filters">
        <Link
          href="/map"
          className={`filter-pill ${!type && !favoritedOnly ? "active" : ""}`}
        >
          전체
        </Link>
        {PLACE_TYPES.map((t) => (
          <Link
            key={t}
            href={`/map?type=${encodeURIComponent(t)}`}
            className={`filter-pill ${!favoritedOnly && type === t ? "active" : ""}`}
          >
            {t}
          </Link>
        ))}
        <Link
          href="/map?favorited=1"
          className={`filter-pill ${favoritedOnly ? "active" : ""}`}
        >
          ♥ 찜한 곳
        </Link>
      </nav>

      {favoritedOnly && !user ? (
        <div className="empty">
          찜한 곳을 보려면 로그인이 필요해요.
          <br />
          <Link href="/login" className="btn btn-sm" style={{ marginTop: 12 }}>
            로그인
          </Link>
        </div>
      ) : (
        <>
      <PlacesMap places={mapPlaces} />

      <div className="place-list">
        {places.length === 0 && favoritedOnly ? (
          <div className="empty">
            아직 찜한 곳이 없어요.
            <br />
            마음에 드는 장소에서 ♥를 눌러보세요!
          </div>
        ) : (
          places.map((p) => {
            const ti = placeTypeInfo(p.type);
            return (
              <Link key={p.id} href={`/places/${p.id}`} className="place-row">
                <span
                  className="place-ic"
                  style={{ background: `${ti.color}22`, color: ti.color }}
                >
                  {ti.emoji}
                </span>
                <span className="place-main">
                  <span className="place-name">
                    {p.name}
                    {p.favoritedByMe && (
                      <span className="fav-inline" aria-label="찜한 곳">
                        {" "}
                        ♥
                      </span>
                    )}
                  </span>
                  <span className="place-sub">
                    {p.type} · {p.address}
                  </span>
                </span>
                <span className="place-rate">
                  {p.reviewCount > 0 ? (
                    <>
                      <b>{p.avgRating.toFixed(1)}</b>{" "}
                      <span className="star-sm">★</span>{" "}
                      <span className="rev-n">({p.reviewCount})</span>
                    </>
                  ) : (
                    <span className="rev-n">리뷰 없음</span>
                  )}
                </span>
              </Link>
            );
          })
        )}
      </div>
        </>
      )}
    </>
  );
}
