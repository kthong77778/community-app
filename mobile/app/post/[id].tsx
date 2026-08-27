import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, apiRequest } from "@/api/client";
import type { Comment, PostView } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { catStyle, colors, radius } from "@/theme";

interface PostResponse {
  post: PostView;
  comments: Comment[];
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<PostView | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    "loading",
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<PostResponse>(`/api/posts/${id}`);
      setPost(data.post);
      setComments(data.comments);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus("notfound");
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleLike() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!post) return;
    const prev = post;
    // Optimistic update.
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    });
    try {
      const data = await apiRequest<{ likeCount: number; likedByMe: boolean }>(
        `/api/posts/${id}/like`,
        { method: "POST" },
      );
      setPost((p) =>
        p ? { ...p, likeCount: data.likeCount, likedByMe: data.likedByMe } : p,
      );
    } catch {
      setPost(prev); // revert
    }
  }

  function confirmDeletePost() {
    Alert.alert("게시글 삭제", "이 게시글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/posts/${id}`, { method: "DELETE" });
            router.back();
          } catch (err) {
            Alert.alert("오류", errorMessage(err));
          }
        },
      },
    ]);
  }

  async function submitComment() {
    const text = comment.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/posts/${id}/comments`, {
        method: "POST",
        body: { content: text },
      });
      setComment("");
      await load();
    } catch (err) {
      Alert.alert("오류", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDeleteComment(commentId: string) {
    Alert.alert("댓글 삭제", "댓글을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/comments/${commentId}`, { method: "DELETE" });
            await load();
          } catch (err) {
            Alert.alert("오류", errorMessage(err));
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

  if (status === "notfound" || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>게시글을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const isAuthor = user?.id === post.authorId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          headerRight: () =>
            isAuthor ? (
              <Pressable onPress={confirmDeletePost} hitSlop={8}>
                <Text style={styles.deleteLink}>삭제</Text>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.postCard}>
          <View style={[styles.badge, { backgroundColor: catStyle(post.category).bg }]}>
            <Text style={[styles.badgeText, { color: catStyle(post.category).fg }]}>
              {post.category}
            </Text>
          </View>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.meta}>
            <Text
              style={[styles.metaText, styles.authorLink]}
              onPress={() => router.push(`/user/${post.authorId}`)}
            >
              {post.authorName}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{timeAgo(post.createdAt)}</Text>
          </View>
          <Text style={styles.body}>{post.content}</Text>
          <Pressable
            style={[styles.likeBtn, post.likedByMe && styles.likeBtnActive]}
            onPress={toggleLike}
          >
            <Text
              style={[
                styles.likeText,
                post.likedByMe && styles.likeTextActive,
              ]}
            >
              ♥ 좋아요 {post.likeCount}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>댓글 {comments.length}</Text>

        {user ? (
          <View style={styles.commentForm}>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="댓글을 입력하세요"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
            />
            <Pressable
              style={[
                styles.commentSubmit,
                (!comment.trim() || submitting) && styles.btnDisabled,
              ]}
              onPress={submitComment}
              disabled={!comment.trim() || submitting}
            >
              <Text style={styles.commentSubmitText}>
                {submitting ? "등록 중..." : "댓글 등록"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => router.push("/login")}>
            <Text style={styles.muted}>
              댓글을 남기려면 로그인하세요.
            </Text>
          </Pressable>
        )}

        {comments.length === 0 ? (
          <Text style={styles.mutedPad}>아직 댓글이 없습니다.</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={styles.commentHead}>
                <Text style={styles.metaText}>
                  <Text style={styles.commentAuthor}>{c.authorName}</Text>
                  {" · "}
                  {timeAgo(c.createdAt)}
                </Text>
                {user?.id === c.authorId && (
                  <Pressable onPress={() => confirmDeleteComment(c.id)} hitSlop={8}>
                    <Text style={styles.deleteLink}>삭제</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.commentBody}>{c.content}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "요청을 처리하지 못했습니다.";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  scroll: { padding: 16, paddingBottom: 48 },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  metaText: { fontSize: 13, color: colors.textMuted },
  authorLink: { color: colors.primaryStrong, fontWeight: "700" },
  metaDot: { fontSize: 13, color: colors.border },
  body: { fontSize: 15, color: colors.text, lineHeight: 23, marginBottom: 18 },
  likeBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  likeBtnActive: { borderColor: colors.like, backgroundColor: colors.likeBg },
  likeText: { fontSize: 14, fontWeight: "600", color: colors.text },
  likeTextActive: { color: colors.like },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 28,
    marginBottom: 12,
  },
  commentForm: { marginBottom: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: "top",
  },
  commentSubmit: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 8,
  },
  commentSubmitText: { color: colors.primaryText, fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  comment: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
  },
  commentHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: { fontWeight: "700", color: colors.text },
  commentBody: { fontSize: 14, color: colors.text, lineHeight: 21 },
  deleteLink: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  muted: { color: colors.textMuted, fontSize: 14, paddingVertical: 8 },
  mutedPad: { color: colors.textMuted, fontSize: 14, paddingVertical: 16 },
});
