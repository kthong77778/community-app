import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import type { PostView } from "@/api/types";
import { colors, radius } from "@/theme";

export default function NewPostScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiRequest<{ post: PostView }>("/api/posts", {
        method: "POST",
        body: { title, content },
      });
      // Replace the modal with the created post's detail screen.
      router.replace(`/post/${data.post.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "글 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {error && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>{error}</Text>
          </View>
        )}
        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력하세요"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />
        <Text style={styles.label}>내용</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={content}
          onChangeText={setContent}
          placeholder="내용을 입력하세요"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={5000}
        />
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryBtn, (!canSubmit || submitting) && styles.disabled]}
            onPress={submit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? "등록 중..." : "등록"}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>취소</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  textarea: { minHeight: 200, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
  alert: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  alertText: { color: colors.danger, fontSize: 14 },
});
