import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { apiRequest } from "@/api/client";
import type { PlaceView } from "@/api/types";
import { BottomNav } from "@/components/BottomNav";
import { colors, PLACE_TYPES, placeType, radius } from "@/theme";

const FAV_KEY = "__fav__";
const TABS: { key: string | null; label: string }[] = [
  { key: null, label: "전체" },
  ...PLACE_TYPES.map((t) => ({ key: t.key as string, label: t.key })),
  { key: FAV_KEY, label: "♥ 찜" },
];

// Builds a self-contained Leaflet + OpenStreetMap page (no API key needed).
// Tapping a marker posts the place id back to React Native.
function buildMapHtml(places: PlaceView[]): string {
  const markers = places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    color: placeType(p.type).color,
  }));
  const data = JSON.stringify(markers).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0}#map{background:#e9efe1}
.pin{width:24px;height:24px;border-radius:50% 50% 50% 2px;border:2.5px solid #fff;transform:rotate(45deg);box-shadow:0 2px 5px rgba(0,0,0,.35)}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var places = ${data};
  var map = L.map('map', { zoomControl: true }).setView([37.553, 126.98], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  var group = [];
  places.forEach(function (p) {
    var icon = L.divIcon({ className: '', html: '<div class="pin" style="background:' + p.color + '"></div>', iconSize: [24,24], iconAnchor: [12,24] });
    var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(p.name);
    m.on('click', function () { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(p.id); });
    group.push(m);
  });
  if (group.length) { try { map.fitBounds(L.featureGroup(group).getBounds().pad(0.2)); } catch (e) {} }
</script></body></html>`;
}

export default function MapScreen() {
  const router = useRouter();
  const [places, setPlaces] = useState<PlaceView[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const q =
        activeType === FAV_KEY
          ? "?favorited=1"
          : activeType
            ? `?type=${encodeURIComponent(activeType)}`
            : "";
      const data = await apiRequest<{ places: PlaceView[] }>(`/api/places${q}`);
      setPlaces(data.places);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const html = useMemo(() => buildMapHtml(places), [places]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "동네 지도" }} />

      <View style={styles.filterBar}>
        {TABS.map((t) => {
          const active = t.key === activeType;
          return (
            <Pressable
              key={t.label}
              onPress={() => {
                setLoading(true);
                setActiveType(t.key);
              }}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.mapBox}>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.web}
          onMessage={(e) => {
            const id = e.nativeEvent.data;
            if (id) router.push(`/place/${id}`);
          }}
        />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionLabel}>장소 목록</Text>
        {loading && places.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : places.length === 0 ? (
          <Text style={styles.mutedPad}>
            {activeType === FAV_KEY
              ? "아직 찜한 곳이 없어요. 마음에 드는 장소에서 ♥를 눌러보세요!"
              : "장소가 없어요."}
          </Text>
        ) : (
          places.map((p) => {
            const ti = placeType(p.type);
            return (
              <Pressable
                key={p.id}
                style={styles.row}
                onPress={() => router.push(`/place/${p.id}`)}
              >
                <View style={[styles.rowIc, { backgroundColor: ti.color + "22" }]}>
                  <Text style={{ fontSize: 18 }}>{ti.emoji}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {p.name}
                    {p.favoritedByMe ? (
                      <Text style={styles.favMark}> ♥</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {p.type} · {p.address}
                  </Text>
                </View>
                <Text style={styles.rowRate}>
                  {p.reviewCount > 0 ? (
                    <>
                      <Text style={styles.rateNum}>{p.avgRating.toFixed(1)}</Text>
                      <Text style={styles.star}> ★</Text>
                      <Text style={styles.rowSub}> ({p.reviewCount})</Text>
                    </>
                  ) : (
                    <Text style={styles.rowSub}>리뷰 없음</Text>
                  )}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <BottomNav active="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  filterBar: { flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 10 },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  pillTextActive: { color: colors.primaryText },
  mapBox: {
    height: 320,
    marginHorizontal: 12,
    borderRadius: radius,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  web: { flex: 1, backgroundColor: "#e9efe1" },
  listContent: { padding: 12, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowIc: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: 12.5, color: colors.textMuted },
  rowRate: { fontSize: 13, color: colors.text },
  rateNum: { fontSize: 15, fontWeight: "800", color: colors.text },
  star: { color: "#f59e0b" },
  favMark: { color: colors.like },
  mutedPad: { color: colors.textMuted, fontSize: 14, paddingVertical: 16 },
});
