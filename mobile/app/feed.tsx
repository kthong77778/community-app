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
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { colors, radius } from "@/theme";

const PAGE_SIZE = 20;

export default function FeedScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  // Load the first page (also used by focus reload and pull-to-refresh).
  const loadFirst = useCallback(async () => {
    try {
      const data = await apiRequest<PostPage>(
        `/api/posts?limit=${PAGE_SIZE}&offset=0`,
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
  }, []);

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
        `/api/posts?limit=${PAGE_SIZE}&offset=${nextOffset}`,
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
  }, [loadingMore, hasMore, nextOffset]);

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
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
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, paddingBottom: 96 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerUser: { color: colors.textMuted, fontSize: 14 },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 6 },
  cardExcerpt: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { fontSize: 13, color: colors.border },
  empty: { alignItems: "center", paddingVertical: 64 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
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
