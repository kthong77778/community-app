import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => {
              if (!on) router.replace(t.to);
            }}
          >
            <Text style={[styles.icon, on ? styles.iconOn : styles.iconOff]}>
              {t.icon}
            </Text>
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
  icon: { fontSize: 19, lineHeight: 21 },
  iconOn: {},
  iconOff: { opacity: 0.85 },
  label: { fontSize: 9.5, fontWeight: "700", color: colors.textMuted },
  labelOn: { color: colors.primary },
});
