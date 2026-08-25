import Constants from "expo-constants";
import { Platform } from "react-native";

// The base URL of the Next.js backend.
//
// Set EXPO_PUBLIC_API_URL to point the app at your server, e.g.
//   EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
// On a real device this MUST be your computer's LAN IP (not localhost), because
// "localhost" on the phone refers to the phone itself.
//
// When unset, we make a best effort for local development:
//   - Android emulator reaches the host machine at 10.0.2.2
//   - iOS simulator / web can use localhost
//   - A physical device falls back to the Metro host's IP if we can detect it.
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const port = 3000;

  // Try to derive the dev machine's IP from the Expo host (e.g. "192.168.0.10:8081").
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${port}`;
  }

  if (Platform.OS === "android") return `http://10.0.2.2:${port}`;
  return `http://localhost:${port}`;
}

export const API_BASE_URL = resolveBaseUrl();
