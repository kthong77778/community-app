import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthContext";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: "700" },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="feed" options={{ title: "댕냥마을" }} />
          <Stack.Screen name="map" options={{ title: "동네 지도" }} />
          <Stack.Screen name="place/[id]" options={{ title: "장소" }} />
          <Stack.Screen name="market" options={{ title: "중고거래" }} />
          <Stack.Screen name="item/[id]" options={{ title: "상품" }} />
          <Stack.Screen name="sell" options={{ title: "상품 등록", presentation: "modal" }} />
          <Stack.Screen name="new" options={{ title: "글쓰기", presentation: "modal" }} />
          <Stack.Screen name="post/[id]" options={{ title: "게시글" }} />
          <Stack.Screen name="login" options={{ title: "로그인" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
