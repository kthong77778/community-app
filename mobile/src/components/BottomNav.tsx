import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { apiRequest } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { CHAT_ENABLED } from "@/features";
import { colors } from "@/theme";

const TABS = [
  { key: "feed", to: "/feed", icon: "🏠", label: "커뮤니티" },
  { key: "map", to: "/map", icon: "🗺️", label: "지도" },
  { key: "market", to: "/market", icon: "🛒", label: "중고거래" },
  { key: "chats", to: "/chats", icon: "💬", label: "채팅" },
  { key: "shop", to: "/shop", icon: "🛍️", label: "쇼핑" },
] as const;

// A simple bottom tab bar shown on the top-level screens. Uses replace so
// switching tabs doesn't stack navigation history.
export function BottomNav({
  active,
}: {
  active: "feed" | "map" | "market" | "chats" | "shop";
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // 로그인 상태에서 총 안 읽음 개수를 마운트 시 + 8초마다 폴링. 실패는 조용히 무시.
  useEffect(() => {
    if (!user || !CHAT_ENABLED) {
      setUnread(0);
      return;
    }
    let alive = true;
    const poll = async () => {
      try {
        const data = await apiRequest<{ count: number }>(
          "/api/conversations/unread-count",
        );
        if (alive) setUnread(data.count);
      } catch {
        // 기존 UI 유지
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  return (
    <View style={styles.bar}>
      {TABS.filter((t) => CHAT_ENABLED || t.key !== "chats").map((t) => {
        const on = t.key === active;
        const showBadge = t.key === "chats" && !!user && unread > 0;
        return (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => {
              if (!on) router.replace(t.to);
            }}
          >
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, on ? styles.iconOn : styles.iconOff]}>
                {t.icon}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.label, on && styles.labelOn]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: "center", paddingTop: 9, paddingBottom: 10, paddingHorizontal: 1, gap: 2 },
  iconWrap: { position: "relative" },
  badge: {
    position: "absolute",
    top: -5,
    right: -12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.primaryText, fontSize: 9, fontWeight: "800", lineHeight: 12 },
  icon: { fontSize: 19, lineHeight: 21 },
  iconOn: {},
  iconOff: { opacity: 0.85 },
  label: { fontSize: 9.5, fontWeight: "700", color: colors.textMuted },
  labelOn: { color: colors.primary },
});
