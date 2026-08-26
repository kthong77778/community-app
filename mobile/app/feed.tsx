import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "@/api/client";
import type { PostPage, PostView } from "@/api/types";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { CATEGORIES, catStyle, colors, radius } from "@/theme";

const PAGE_SIZE = 20;
const TABS: { key: string | null; label: string }[] = [
  { key: null, label: "전체" },
  ...CATEGORIES.map((c) => ({ key: c as string, label: c })),
];

function catQuery(cat: string | null): string {
  return cat ? `&category=${encodeURIComponent(cat)}` : "";
}

export default function FeedScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  // Load the first page for the active category. Recreated when the category
  // changes, so useFocusEffect re-runs it on both focus and tab switch.
  const loadFirst = useCallback(async () => {
    try {
      const data = await apiRequest<PostPage>(
        `/api/posts?limit=${PAGE_SIZE}&offset=0${catQuery(activeCat)}`,
      );
      setPosts(data.posts);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch {
      // Keep whatever we already show; a pull-to-refresh can retry.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCat]);

  // Reload whenever the feed regains focus (e.g. after posting).
  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst]),
  );

  function onRefresh() {
    setRefreshing(true);
    void loadFirst();
  }

  // Append the next page when the user scrolls to the end.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<PostPage>(
        `/api/posts?limit=${PAGE_SIZE}&offset=${nextOffset}${catQuery(activeCat)}`,
      );
      // De-dupe in case a new post shifted offsets between pages.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.posts.filter((p) => !seen.has(p.id))];
      });
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch {
      // ignore; user can scroll again to retry
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextOffset, activeCat]);

  function selectCat(cat: string | null) {
    if (cat === activeCat) return;
    setLoading(true);
    setActiveCat(cat);
  }

  function onWrite() {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push("/new");
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () =>
            user ? (
              <View style={styles.headerRight}>
                <Text style={styles.headerUser}>{user.username}님</Text>
                <Pressable onPress={logout} hitSlop={8}>
                  <Text style={styles.headerLink}>로그아웃</Text>
                </Pressable>
              </View>
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
              onPress={() => selectCat(t.key)}
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
          data={posts}
          style={styles.list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>아직 게시글이 없습니다.</Text>
              <Text style={styles.emptyText}>첫 글을 남겨보세요!</Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/post/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <View
                  style={[styles.badge, { backgroundColor: catStyle(item.category).bg }]}
                >
                  <Text style={[styles.badgeText, { color: catStyle(item.category).fg }]}>
                    {item.category}
                  </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardExcerpt} numberOfLines={2}>
                {item.content}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{item.authorName}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{timeAgo(item.createdAt)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>♥ {item.likeCount}</Text>
                <Text style={styles.metaText}>💬 {item.commentCount}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={onWrite}>
        <Text style={styles.fabText}>＋ 글쓰기</Text>
      </Pressable>

      <BottomNav active="feed" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 96 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerUser: { color: colors.textMuted, fontSize: 14 },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  filterBar: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.bg,
  },
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 11.5, fontWeight: "700" },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  cardExcerpt: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { fontSize: 13, color: colors.border },
  empty: { alignItems: "center", paddingVertical: 64 },
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
