import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import type { PlaceView, Review } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { MAP_PROVIDERS, openDirections } from "@/lib/directions";
import { colors, placeType, radius } from "@/theme";

function starStr(n: number): string {
  const r = Math.round(n);
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [place, setPlace] = useState<PlaceView | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ place: PlaceView; reviews: Review[] }>(
        `/api/places/${id}`,
      );
      setPlace(data.place);
      setReviews(data.reviews);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus("notfound");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleFavorite() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (favBusy || !place) return;
    setFavBusy(true);
    const prev = place;
    const nextFav = !place.favoritedByMe;
    setPlace({
      ...place,
      favoritedByMe: nextFav,
      favoriteCount: (place.favoriteCount ?? 0) + (nextFav ? 1 : -1),
    });
    try {
      const data = await apiRequest<{ favorited: boolean }>(
        `/api/places/${id}/favorite`,
        { method: "POST" },
      );
      setPlace((cur) => (cur ? { ...cur, favoritedByMe: data.favorited } : cur));
    } catch (err) {
      setPlace(prev);
      Alert.alert("오류", err instanceof ApiError ? err.message : "찜 처리 실패");
    } finally {
      setFavBusy(false);
    }
  }

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/places/${id}/reviews`, {
        method: "POST",
        body: { rating, text },
      });
      setText("");
      setRating(5);
      await load();
    } catch (err) {
      Alert.alert("오류", err instanceof ApiError ? err.message : "리뷰 등록 실패");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === "notfound" || !place) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>장소를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const ti = placeType(place.type);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: place.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={[styles.bigIc, { backgroundColor: ti.color + "22" }]}>
            <Text style={{ fontSize: 26 }}>{ti.emoji}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: ti.color + "22" }]}>
            <Text style={[styles.badgeText, { color: ti.color }]}>
              {ti.emoji} {place.type}
            </Text>
          </View>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.addr}>📍 {place.address}</Text>
          {place.reviewCount > 0 ? (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingNum}>{place.avgRating.toFixed(1)}</Text>
              <Text style={styles.ratingStars}>{starStr(place.avgRating)}</Text>
              <Text style={styles.muted}>리뷰 {place.reviewCount}개</Text>
            </View>
          ) : (
            <Text style={styles.muted}>아직 리뷰가 없어요</Text>
          )}
          <View style={styles.actionRow}>
            <Pressable style={styles.dirBtn} onPress={() => setSheet(true)}>
              <Text style={styles.dirBtnText}>🧭 길찾기</Text>
            </Pressable>
            <Pressable
              onPress={toggleFavorite}
              disabled={favBusy}
              hitSlop={6}
              style={[styles.favBtn, place.favoritedByMe && styles.favBtnOn]}
            >
              <Text style={[styles.favHeart, place.favoritedByMe && styles.favOnText]}>
                {place.favoritedByMe ? "♥" : "♡"}
              </Text>
              {(place.favoriteCount ?? 0) > 0 && (
                <Text style={[styles.favCount, place.favoritedByMe && styles.favOnText]}>
                  {place.favoriteCount}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {user ? (
          <>
            <Text style={styles.sectionLabel}>리뷰 쓰기</Text>
            <View style={styles.starPick}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                  <Text style={[styles.starBtn, n <= rating && styles.starOn]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="방문 후기를 남겨주세요"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[styles.submit, (!text.trim() || submitting) && styles.disabled]}
              onPress={submit}
              disabled={!text.trim() || submitting}
            >
              <Text style={styles.submitText}>{submitting ? "등록 중..." : "리뷰 등록"}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => router.push("/login")}>
            <Text style={[styles.muted, { marginTop: 18 }]}>
              리뷰를 남기려면 로그인하세요.
            </Text>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>리뷰 {reviews.length}</Text>
        {reviews.length === 0 ? (
          <Text style={styles.mutedPad}>아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.review}>
              <View style={styles.rvHead}>
                <Text style={styles.rvName}>{r.authorName}</Text>
                <Text style={styles.rvStars}>{starStr(r.rating)}</Text>
              </View>
              <Text style={styles.rvTime}>{timeAgo(r.createdAt)}</Text>
              <Text style={styles.rvBody}>{r.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Directions chooser */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>🧭 {place.name} 길찾기</Text>
          <Text style={styles.sheetSub}>원하는 지도 앱으로 이동합니다</Text>
          <View style={styles.mapGrid}>
            {MAP_PROVIDERS.map((m) => (
              <Pressable
                key={m.key}
                style={styles.mapBtn}
                onPress={() => {
                  setSheet(false);
                  void openDirections(m.key, {
                    name: place.name,
                    lat: place.lat,
                    lng: place.lng,
                  });
                }}
              >
                <View style={[styles.mapDot, { backgroundColor: m.color }]} />
                <Text style={styles.mapBtnText}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.closeBtn} onPress={() => setSheet(false)}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  head: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 20,
  },
  bigIc: { width: 54, height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  name: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  addr: { color: colors.textMuted, fontSize: 13.5, marginTop: 6, marginBottom: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingNum: { fontSize: 22, fontWeight: "800", color: colors.text },
  ratingStars: { color: "#f59e0b", fontSize: 15, letterSpacing: 1 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  dirBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  dirBtnText: { fontWeight: "700", fontSize: 14, color: colors.text },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  favBtnOn: { borderColor: colors.like, backgroundColor: colors.likeBg },
  favHeart: { fontSize: 16, fontWeight: "700", color: colors.textMuted },
  favCount: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  favOnText: { color: colors.like },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 12,
  },
  starPick: { flexDirection: "row", gap: 4, marginBottom: 10 },
  starBtn: { fontSize: 30, color: colors.border },
  starOn: { color: "#f59e0b" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 84,
    textAlignVertical: "top",
  },
  submit: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 10,
  },
  submitText: { color: colors.primaryText, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
  review: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.border },
  rvHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rvName: { fontWeight: "700", fontSize: 14, color: colors.text },
  rvStars: { color: "#f59e0b", fontSize: 13 },
  rvTime: { color: colors.textMuted, fontSize: 12, marginBottom: 5 },
  rvBody: { fontSize: 14.5, color: colors.text, lineHeight: 21 },
  muted: { color: colors.textMuted, fontSize: 14 },
  mutedPad: { color: colors.textMuted, fontSize: 14, paddingVertical: 16 },
  // sheet
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  sheetSub: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 },
  mapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mapBtn: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  mapDot: { width: 14, height: 14, borderRadius: 7 },
  mapBtnText: { fontWeight: "700", fontSize: 14.5, color: colors.text },
  closeBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeText: { fontWeight: "600", color: colors.text },
});
