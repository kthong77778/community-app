import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "@/api/client";
import { isAdmin } from "@/admin";
import type { ReportView } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { timeAgo } from "@/lib/format";
import { colors, radius } from "@/theme";

export default function AdminReportsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const admin = isAdmin(user?.username);

  const [reports, setReports] = useState<ReportView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const data = await apiRequest<{ reports: ReportView[] }>("/api/admin/reports");
      setReports(data.reports);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [admin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!authLoading && !admin) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "신고함" }} />
        <Text style={styles.muted}>권한이 없습니다.</Text>
      </View>
    );
  }

  if (status === "loading" || authLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "신고함" }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "신고함" }} />
        <Text style={styles.muted}>신고 목록을 불러오지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "신고함" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {reports.length === 0 ? (
          <Text style={styles.emptyText}>접수된 신고가 없어요.</Text>
        ) : (
          reports.map((r) => {
            const isPost = r.targetType === "post";
            return (
              <Pressable
                key={r.id}
                style={styles.card}
                onPress={() =>
                  router.push(
                    isPost ? `/post/${r.targetId}` : `/item/${r.targetId}`,
                  )
                }
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.kindBadge,
                      isPost ? styles.kindPost : styles.kindItem,
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindText,
                        isPost ? styles.kindPostText : styles.kindItemText,
                      ]}
                    >
                      {isPost ? "글" : "상품"}
                    </Text>
                  </View>
                  <Text style={styles.title} numberOfLines={1}>
                    {r.targetTitle ?? "삭제됨"}
                  </Text>
                </View>
                <Text style={styles.reason}>
                  {r.reason?.trim() ? r.reason : "사유 없음"}
                </Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>신고자 {r.reporterId}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{timeAgo(r.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  muted: { color: colors.textMuted, fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 48 },
  emptyText: { color: colors.textMuted, fontSize: 14, paddingVertical: 24, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  kindPost: { backgroundColor: "#dbeafe" },
  kindItem: { backgroundColor: colors.primarySoft },
  kindText: { fontSize: 11.5, fontWeight: "700" },
  kindPostText: { color: "#1d4ed8" },
  kindItemText: { color: colors.primaryStrong },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  reason: { fontSize: 14, color: colors.text, marginBottom: 10, lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { fontSize: 13, color: colors.border },
});
