import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest, imageUri } from "@/api/client";
import { isAdmin } from "@/admin";
import type { Item, PostView } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import {
  catStyle,
  colors,
  itemEmoji,
  radius,
  statusStyle,
  won,
} from "@/theme";

interface UserProfile {
  id: string;
  postCount: number;
  itemCount: number;
  posts: PostView[];
  items: Item[];
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<UserProfile>(`/api/users/${id}`);
      setProfile(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onLogout() {
    await logout();
    router.replace("/feed");
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: id }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === "error" || !profile) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: id }} />
        <Text style={styles.muted}>사용자를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const isMe = user?.id === id;
  const initial = profile.id.slice(0, 1).toUpperCase();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: profile.id }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.username}>{profile.id}</Text>
          <Text style={styles.counts}>
            글 {profile.postCount} · 판매 {profile.itemCount}
          </Text>
          {isMe && isAdmin(user?.username) && (
            <Pressable
              style={styles.reportsBtn}
              onPress={() => router.push("/admin/reports")}
            >
              <Text style={styles.reportsText}>🚩 신고함</Text>
            </Pressable>
          )}
          {isMe && (
            <Pressable style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>판매 상품</Text>
        {profile.items.length === 0 ? (
          <Text style={styles.emptyText}>등록한 상품이 없어요.</Text>
        ) : (
          <View style={styles.grid}>
            {profile.items.map((item) => {
              const st = statusStyle(item.status);
              const done = item.status === "판매완료";
              return (
                <Pressable
                  key={item.id}
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
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>작성한 글</Text>
        {profile.posts.length === 0 ? (
          <Text style={styles.emptyText}>작성한 글이 없어요.</Text>
        ) : (
          profile.posts.map((post) => (
            <Pressable
              key={post.id}
              style={styles.postCard}
              onPress={() => router.push(`/post/${post.id}`)}
            >
              <View style={styles.postTop}>
                <View style={[styles.badge, { backgroundColor: catStyle(post.category).bg }]}>
                  <Text style={[styles.badgeText, { color: catStyle(post.category).fg }]}>
                    {post.category}
                  </Text>
                </View>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {post.title}
                </Text>
              </View>
              <Text style={styles.postExcerpt} numberOfLines={2}>
                {post.content}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{timeAgo(post.createdAt)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>♥ {post.likeCount}</Text>
                <Text style={styles.metaText}>💬 {post.commentCount}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const GAP = 12;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 48 },
  header: { alignItems: "center", paddingVertical: 12, marginBottom: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: colors.primaryStrong },
  username: { fontSize: 20, fontWeight: "800", color: colors.text },
  counts: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  logoutBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  logoutText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  reportsBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.primarySoft,
  },
  reportsText: { color: colors.primaryStrong, fontWeight: "700", fontSize: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 22,
    marginBottom: 12,
  },
  emptyText: { color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  card: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardDone: { opacity: 0.62 },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface2 },
  thumbEmoji: { alignItems: "center", justifyContent: "center" },
  stBadge: { position: "absolute", left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 19 },
  cardPrice: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  postTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 11.5, fontWeight: "700" },
  postTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  postExcerpt: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { fontSize: 13, color: colors.border },
});
