"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
}

// Loads Leaflet from CDN once and resolves when window.L is ready.
let leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Leaflet 로드 실패"));
    document.body.appendChild(s);
  });
  return leafletPromise;
}

// A Leaflet + OpenStreetMap map (no API key needed). Clicking a marker opens
// the place detail page.
export function PlacesMap({ places }: { places: MapPlace[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    loadLeaflet()
      .then(() => {
        if (cancelled || !ref.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L;
        map = L.map(ref.current, { zoomControl: true }).setView([37.553, 126.98], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);

        const markers: unknown[] = [];
        for (const p of places) {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 2px;border:2.5px solid #fff;transform:rotate(45deg);background:${p.color};box-shadow:0 2px 5px rgba(0,0,0,.35)"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
          });
          const m = L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(p.name);
          m.on("click", () => router.push(`/places/${p.id}`));
          markers.push(m);
        }
        if (markers.length) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (map as any).fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Leaflet failed to load; the list below still works.
      });

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [places, router]);

  return <div ref={ref} className="map-canvas" />;
}
