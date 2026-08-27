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
import type { ConversationView } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { timeAgo } from "@/lib/format";
import { colors, radius } from "@/theme";

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ conversations: ConversationView[] }>(
        "/api/conversations",
      );
      setConversations(data.conversations);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 화면 포커스 동안 5초마다 목록/뱃지를 재조회. 화면을 벗어나면 정지.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => {
        void load();
      }, 5000);
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "채팅" }} />
        <View style={styles.center}>
          <Text style={styles.emptyBig}>💬</Text>
          <Text style={styles.emptyText}>로그인하고 채팅을 시작해보세요.</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
            <Text style={styles.loginBtnText}>로그인</Text>
          </Pressable>
        </View>
        <BottomNav active="chats" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "채팅",
          headerRight: () =>
            user ? null : (
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
          data={conversations}
          style={styles.list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBig}>💬</Text>
              <Text style={styles.emptyText}>아직 대화가 없어요.</Text>
              <Text style={styles.emptyText}>
                관심 상품에서 채팅을 시작해보세요.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const unread = item.unreadCount > 0;
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/chat/${item.id}`)}
              >
                {item.itemImageUrl ? (
                  <Image source={{ uri: imageUri(item.itemImageUrl) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmoji]}>
                    <Text style={{ fontSize: 26 }}>📦</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.name, unread && styles.nameUnread]}
                      numberOfLines={1}
                    >
                      {item.otherUserId}
                    </Text>
                    <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.itemTitle ?? "삭제된 상품"}
                  </Text>
                  <View style={styles.previewRow}>
                    <Text
                      style={[styles.preview, unread && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {item.lastMessageText ?? "대화를 시작해보세요"}
                    </Text>
                    {unread && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unreadCount > 99 ? "99+" : item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <BottomNav active="chats" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 84 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  thumbEmoji: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, justifyContent: "center", gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  nameUnread: { fontWeight: "800" },
  time: { fontSize: 12, color: colors.textMuted },
  itemTitle: { fontSize: 13, color: colors.textMuted },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontSize: 14, color: colors.text },
  previewUnread: { fontWeight: "700", color: colors.text },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 60, width: "100%" },
  emptyBig: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
  loginBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  loginBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
});
