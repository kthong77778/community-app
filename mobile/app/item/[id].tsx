import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import type { Conversation, Item } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import {
  colors,
  ITEM_STATUSES,
  itemEmoji,
  radius,
  statusStyle,
  won,
} from "@/theme";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [favBusy, setFavBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ item: Item }>(`/api/items/${id}`);
      setItem(data.item);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus("notfound");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function changeStatus(next: string) {
    try {
      const data = await apiRequest<{ item: Item }>(`/api/items/${id}`, {
        method: "PATCH",
        body: { status: next },
      });
      setItem(data.item);
    } catch (err) {
      Alert.alert("오류", err instanceof ApiError ? err.message : "상태 변경 실패");
    }
  }

  async function toggleFavorite() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (favBusy || !item) return;
    setFavBusy(true);
    const prev = item;
    const nextFav = !item.favoritedByMe;
    setItem({
      ...item,
      favoritedByMe: nextFav,
      favoriteCount: (item.favoriteCount ?? 0) + (nextFav ? 1 : -1),
    });
    try {
      const data = await apiRequest<{ favorited: boolean }>(
        `/api/items/${id}/favorite`,
        { method: "POST" },
      );
      setItem((cur) => (cur ? { ...cur, favoritedByMe: data.favorited } : cur));
    } catch (err) {
      setItem(prev);
      Alert.alert("오류", err instanceof ApiError ? err.message : "찜 처리 실패");
    } finally {
      setFavBusy(false);
    }
  }

  async function startChat() {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const data = await apiRequest<{ conversation: Conversation }>(
        "/api/conversations",
        { method: "POST", body: { itemId: id } },
      );
      router.push(`/chat/${data.conversation.id}`);
    } catch (err) {
      Alert.alert("오류", err instanceof ApiError ? err.message : "채팅을 시작할 수 없습니다.");
    }
  }

  function confirmDelete() {
    Alert.alert("상품 삭제", "이 상품을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/items/${id}`, { method: "DELETE" });
            router.back();
          } catch (err) {
            Alert.alert("오류", err instanceof ApiError ? err.message : "삭제 실패");
          }
        },
      },
    ]);
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === "notfound" || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>상품을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const isSeller = user?.id === item.sellerId;
  const st = statusStyle(item.status);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: item.title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroEmoji]}>
            <Text style={{ fontSize: 76 }}>{itemEmoji(item.category)}</Text>
          </View>
        )}

        <View style={styles.detail}>
          <View style={styles.top}>
            <View style={[styles.stBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.stBadgeText, { color: st.fg }]}>{item.status}</Text>
            </View>
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>
                {itemEmoji(item.category)} {item.category}
              </Text>
            </View>
            <Pressable
              onPress={toggleFavorite}
              disabled={favBusy}
              hitSlop={8}
              style={[styles.favBtn, item.favoritedByMe && styles.favBtnOn, { marginLeft: "auto" }]}
            >
              <Text style={[styles.favHeart, item.favoritedByMe && styles.favOnText]}>
                {item.favoritedByMe ? "♥" : "♡"}
              </Text>
              {(item.favoriteCount ?? 0) > 0 && (
                <Text style={[styles.favCount, item.favoritedByMe && styles.favOnText]}>
                  {item.favoriteCount}
                </Text>
              )}
            </Pressable>
            {isSeller && (
              <Pressable onPress={confirmDelete} hitSlop={8}>
                <Text style={styles.deleteLink}>삭제</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>{won(item.price)}</Text>
          <Text style={styles.meta}>
            {item.sellerName} · {item.location} · {timeAgo(item.createdAt)}
          </Text>

          {isSeller && (
            <View style={styles.statusCtl}>
              {ITEM_STATUSES.map((s) => {
                const on = item.status === s;
                return (
                  <Pressable
                    key={s}
                    style={[styles.stOpt, on && styles.stOptOn]}
                    onPress={() => changeStatus(s)}
                  >
                    <Text style={[styles.stOptText, on && styles.stOptTextOn]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.desc}>{item.description}</Text>

          {!isSeller && (
            <Pressable style={styles.chatBtn} onPress={startChat}>
              <Text style={styles.chatText}>💬 채팅하기</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  heroEmoji: { alignItems: "center", justifyContent: "center" },
  detail: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 20,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  stBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stBadgeText: { fontSize: 11.5, fontWeight: "700" },
  catChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.surface2 },
  catChipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  deleteLink: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  favBtnOn: { borderColor: colors.like, backgroundColor: colors.likeBg },
  favHeart: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
  favCount: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  favOnText: { color: colors.like },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  price: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 8, marginBottom: 4 },
  statusCtl: { flexDirection: "row", gap: 8, marginTop: 14 },
  stOpt: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  stOptOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  stOptText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  stOptTextOn: { color: colors.primaryStrong },
  desc: { fontSize: 15, color: colors.text, lineHeight: 23, marginTop: 16 },
  chatBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  chatText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
  muted: { color: colors.textMuted, fontSize: 14 },
});
