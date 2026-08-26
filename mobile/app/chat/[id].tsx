import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import type { ConversationView, Message } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { colors, radius, won } from "@/theme";

interface ThreadResponse {
  conversation: ConversationView;
  messages: Message[];
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Message>>(null);

  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<ThreadResponse>(`/api/conversations/${id}`);
      setConversation(data.conversation);
      setMessages(data.messages);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus("notfound");
    }
  }, [id]);

  // 화면 포커스 동안 3.5초마다 재조회해 새 메시지를 반영(서버가 조회 시 읽음 처리).
  // 화면을 벗어나면 정지.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => {
        void load();
      }, 3500);
      return () => clearInterval(timer);
    }, [load]),
  );

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const data = await apiRequest<{ message: Message }>(
        `/api/conversations/${id}/messages`,
        { method: "POST", body: { text: body } },
      );
      setText("");
      setMessages((prev) => [...prev, data.message]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      Alert.alert("오류", err instanceof ApiError ? err.message : "전송 실패");
    } finally {
      setSending(false);
    }
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === "notfound" || !conversation) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "채팅" }} />
        <Text style={styles.muted}>대화를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const headerTitle = conversation.itemTitle ?? conversation.otherUserId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: headerTitle }} />

      {(conversation.itemTitle || conversation.itemId) && (
        <Pressable
          style={styles.banner}
          disabled={!conversation.itemId}
          onPress={() => {
            if (conversation.itemId) router.push(`/item/${conversation.itemId}`);
          }}
        >
          {conversation.itemImageUrl ? (
            <Image source={{ uri: conversation.itemImageUrl }} style={styles.bannerThumb} />
          ) : (
            <View style={[styles.bannerThumb, styles.bannerEmoji]}>
              <Text style={{ fontSize: 22 }}>📦</Text>
            </View>
          )}
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {conversation.itemTitle ?? "삭제된 상품"}
            </Text>
            {conversation.itemPrice != null && (
              <Text style={styles.bannerPrice}>{won(conversation.itemPrice)}</Text>
            )}
          </View>
        </Pressable>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        style={styles.list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>첫 메시지를 보내보세요.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                  {item.text}
                </Text>
              </View>
              <Text style={styles.bubbleTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendText}>전송</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontSize: 14 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 10,
  },
  bannerThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  bannerEmoji: { alignItems: "center", justifyContent: "center" },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  bannerPrice: { fontSize: 13, fontWeight: "700", color: colors.primaryStrong, marginTop: 2 },
  list: { flex: 1 },
  listContent: { padding: 14, gap: 4 },
  empty: { alignItems: "center", paddingVertical: 40 },
  bubbleRow: { maxWidth: "80%", marginVertical: 3 },
  rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleTextMine: { color: colors.primaryText },
  bubbleTime: { fontSize: 11, color: colors.textMuted, marginTop: 2, marginHorizontal: 4 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.primaryText, fontWeight: "700", fontSize: 14 },
});
