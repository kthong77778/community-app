import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
      // Go back to wherever the user came from (feed / post).
      if (router.canGoBack()) router.back();
      else router.replace("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          placeholder="아이디"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.primaryBtn, submitting && styles.disabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "로그인 중..." : "로그인"}
          </Text>
        </Pressable>
        <Text style={[styles.switchText, { textAlign: "center", marginTop: 16 }]}>
          관리자에게 발급받은 계정으로 로그인하세요.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
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
