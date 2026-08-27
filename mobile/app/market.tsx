import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
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
import { apiRequest, imageUri } from "@/api/client";
import type { Item } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { timeAgo } from "@/lib/format";
import {
  colors,
  ITEM_CATEGORIES,
  itemEmoji,
  radius,
  statusStyle,
  won,
} from "@/theme";

const TABS: { key: string | null; label: string }[] = [
  { key: null, label: "전체" },
  ...ITEM_CATEGORIES.map((c) => ({ key: c as string, label: c })),
];

export default function MarketScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const q = activeCat ? `?category=${encodeURIComponent(activeCat)}` : "";
      const data = await apiRequest<{ items: Item[] }>(`/api/items${q}`);
      setItems(data.items);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [activeCat]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function onSell() {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push("/sell");
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "중고거래",
          headerRight: () =>
            user ? (
              <Pressable onPress={() => router.push(`/user/${user.id}`)} hitSlop={8}>
                <Text style={styles.headerIcon}>👤</Text>
              </Pressable>
            ) : (
              <Link href="/login" style={styles.headerLink}>
                로그인
              </Link>
            ),
        }}
      />

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          style={styles.list}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.col}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBig}>🛒</Text>
              <Text style={styles.emptyText}>등록된 상품이 없어요.</Text>
              <Text style={styles.emptyText}>첫 상품을 올려보세요!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = statusStyle(item.status);
            const done = item.status === "판매완료";
            return (
              <Pressable
                style={[styles.card, done && styles.cardDone]}
                onPress={() => router.push(`/item/${item.id}`)}
              >
                <View style={styles.thumbWrap}>
                  {item.imageUrl ? (
                    <Image source={{ uri: imageUri(item.imageUrl) }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmoji]}>
                      <Text style={{ fontSize: 42 }}>{itemEmoji(item.category)}</Text>
                    </View>
                  )}
                  <View style={[styles.stBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.stBadgeText, { color: st.fg }]}>
                      {item.status}
                    </Text>
                  </View>
                  {item.favoritedByMe && (
                    <View style={styles.favBadge}>
                      <Text style={styles.favBadgeText}>♥</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardPrice}>{won(item.price)}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {item.location} · {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable style={styles.fab} onPress={onSell}>
        <Text style={styles.fabText}>＋ 팔기</Text>
      </Pressable>

      <BottomNav active="market" />
    </View>
  );
}

const GAP = 12;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  headerIcon: { fontSize: 18 },
  filterBar: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 12, paddingVertical: 10 },
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
  cardDone: { opacity: 0.62 },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface2 },
  thumbEmoji: { alignItems: "center", justifyContent: "center" },
  stBadge: { position: "absolute", left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stBadgeText: { fontSize: 11, fontWeight: "700" },
  favBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.likeBg,
  },
  favBadgeText: { fontSize: 13, color: colors.like, fontWeight: "700" },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 19 },
  cardPrice: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  empty: { alignItems: "center", paddingVertical: 60, width: "100%" },
  emptyBig: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 72,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
});
