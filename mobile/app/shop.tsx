import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "@/api/client";
import type { ProductView } from "@/api/types";
import { BottomNav } from "@/components/BottomNav";
import {
  colors,
  PRODUCT_CATEGORIES,
  productEmoji,
  radius,
  won,
} from "@/theme";

const TABS: { key: string | null; label: string }[] = [
  { key: null, label: "전체" },
  ...PRODUCT_CATEGORIES.map((c) => ({ key: c as string, label: c })),
];

type Sort = "lowest" | "latest";

export default function ShopScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("latest");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCat) params.set("category", activeCat);
      if (sort === "lowest") params.set("sort", "lowest");
      const qs = params.toString();
      const data = await apiRequest<{ products: ProductView[] }>(
        `/api/products${qs ? `?${qs}` : ""}`,
      );
      setProducts(data.products);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [activeCat, sort]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "쇼핑" }} />

      <View style={styles.filterBar}>
        {TABS.map((t) => {
          const active = t.key === activeCat;
          return (
            <Pressable
              key={t.label}
              onPress={() => {
                setLoading(true);
                setActiveCat(t.key);
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

      <View style={styles.sortBar}>
        {([
          { key: "latest", label: "최신순" },
          { key: "lowest", label: "최저가순" },
        ] as const).map((s) => {
          const on = s.key === sort;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                if (on) return;
                setLoading(true);
                setSort(s.key);
              }}
              style={[styles.sortOpt, on && styles.sortOptOn]}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          style={styles.list}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBig}>🛍️</Text>
              <Text style={styles.emptyText}>등록된 상품이 없어요.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <View style={styles.thumbWrap}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmoji]}>
                    <Text style={{ fontSize: 42 }}>
                      {productEmoji(item.category)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.cardBrand} numberOfLines={1}>
                  {item.brand}
                </Text>
                {item.offerCount > 0 ? (
                  <>
                    <Text style={styles.cardPrice}>{won(item.lowestPrice)}</Text>
                    <View style={styles.compareBadge}>
                      <Text style={styles.compareText}>
                        {item.offerCount}곳 비교
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.noPrice}>가격정보 없음</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

      <BottomNav active="shop" />
    </View>
  );
}

const GAP = 12;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  pillTextActive: { color: colors.primaryText },
  sortBar: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sortOpt: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortOptOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sortText: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted },
  sortTextOn: { color: colors.primaryStrong },
  listContent: { padding: GAP, paddingBottom: 96 },
  col: { gap: GAP },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: GAP,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface2 },
  thumbEmoji: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 19 },
  cardBrand: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 },
  compareBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  compareText: { fontSize: 11, fontWeight: "700", color: colors.primaryStrong },
  noPrice: { fontSize: 13, color: colors.textMuted, marginTop: 6, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 60, width: "100%" },
  emptyBig: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
