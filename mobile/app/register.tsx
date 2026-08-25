import { Link, useRouter } from "expo-router";
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
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!username.trim() || !password) return;
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await register(username.trim(), password);
      router.replace("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {error && (
            <View style={styles.alert}>
              <Text style={styles.alertText}>{error}</Text>
            </View>
          )}
          <Text style={styles.label}>아이디</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="3~20자"
            placeholderTextColor={colors.textMuted}
            maxLength={20}
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="6자 이상"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="비밀번호 확인"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            style={[styles.primaryBtn, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? "가입 중..." : "회원가입"}
            </Text>
          </Pressable>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>이미 계정이 있으신가요? </Text>
            <Link href="/login" style={styles.switchLink}>
              로그인
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center" },
  card: {
    backgroundColor: colors.surface,
    margin: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  switchText: { color: colors.textMuted, fontSize: 14 },
  switchLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  alert: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  alertText: { color: colors.danger, fontSize: 14 },
});
