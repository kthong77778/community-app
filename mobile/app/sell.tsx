import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import type { Item } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { colors, ITEM_CATEGORIES, itemEmoji } from "@/theme";

export default function SellScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("기타");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("상품명을 입력해 주세요.");
    const priceNum = Math.round(Number(price));
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError("가격을 올바르게 입력해 주세요.");
    if (!location.trim()) return setError("거래 지역을 입력해 주세요.");
    if (!description.trim()) return setError("상품 설명을 입력해 주세요.");

    setSubmitting(true);
    try {
      const data = await apiRequest<{ item: Item }>("/api/items", {
        method: "POST",
        body: { title, price: priceNum, category, location, description, imageUrl },
      });
      router.replace(`/item/${data.item.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h}>상품 등록</Text>
        {error && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>카테고리</Text>
        <View style={styles.catRow}>
          {ITEM_CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {itemEmoji(c)} {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>상품명</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={60} placeholder="상품명" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>가격 (원)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="예: 15000" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>거래 지역</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} maxLength={40} placeholder="예: 서울 마포구" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>사진 URL (선택)</Text>
        <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" placeholder="https://... (없으면 비워두세요)" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>설명</Text>
        <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} maxLength={1000} multiline placeholder="상품 상태, 거래 방법 등을 적어주세요" placeholderTextColor={colors.textMuted} />

        <View style={styles.actions}>
          <Pressable style={[styles.primaryBtn, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
            <Text style={styles.primaryText}>{submitting ? "등록 중..." : "등록"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>취소</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  h: { fontSize: 15, fontWeight: "700", letterSpacing: 0.4, color: colors.textMuted, textTransform: "uppercase", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 14, marginBottom: 6 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.textMuted },
  chipTextOn: { color: colors.primaryStrong },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  textarea: { minHeight: 130, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 20, paddingVertical: 12 },
  primaryText: { color: colors.primaryText, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.5 },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  alert: { backgroundColor: colors.dangerSoft, borderColor: "#fecaca", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  alertText: { color: colors.danger, fontSize: 14 },
});
