import Link from "next/link";
import { PlacesMap } from "@/components/PlacesMap";
import { placeTypeInfo } from "@/lib/placeTypes";
import { getStore } from "@/lib/store";
import { PLACE_TYPES } from "@/lib/store/seed-places";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: raw } = await searchParams;
  const type = PLACE_TYPES.includes(raw as never) ? raw! : null;

  const places = await getStore().listPlaces(type);
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
        <Link href="/map" className={`filter-pill ${!type ? "active" : ""}`}>
          전체
        </Link>
        {PLACE_TYPES.map((t) => (
          <Link
            key={t}
            href={`/map?type=${encodeURIComponent(t)}`}
            className={`filter-pill ${type === t ? "active" : ""}`}
          >
            {t}
          </Link>
        ))}
      </nav>

      <PlacesMap places={mapPlaces} />

      <div className="place-list">
        {places.map((p) => {
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
                <span className="place-name">{p.name}</span>
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
        })}
      </div>
    </>
  );
}
