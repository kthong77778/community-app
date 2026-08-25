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
          <Stack.Screen name="feed" options={{ title: "커뮤니티" }} />
          <Stack.Screen name="new" options={{ title: "글쓰기", presentation: "modal" }} />
          <Stack.Screen name="post/[id]" options={{ title: "게시글" }} />
          <Stack.Screen name="login" options={{ title: "로그인" }} />
          <Stack.Screen name="register" options={{ title: "회원가입" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
