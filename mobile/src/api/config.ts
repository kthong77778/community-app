import Constants from "expo-constants";
import { Platform } from "react-native";

// The base URL of the Next.js backend.
//
// Configuration order:
//   1. EXPO_PUBLIC_API_URL — the explicit setting. Use this in .env files.
//        EXPO_PUBLIC_API_URL=http://192.168.0.10:3000   (dev, real device)
//        EXPO_PUBLIC_API_URL=https://api.your-domain.com (production build)
//   2. Dev auto-detection (only when the var is unset AND the app runs in a
//      development build) — best effort so `expo start` works with no config.
//
// On a real phone "localhost" points at the phone itself, so a LAN IP (dev) or
// a public HTTPS domain (production) is required.
const DEV_PORT = 3000;

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Production/standalone builds must be told where the backend lives.
  if (!__DEV__) {
    console.warn(
      "[config] EXPO_PUBLIC_API_URL is not set. Set it to your deployed " +
        "backend URL before building for release.",
    );
    return "";
  }

  // --- Development auto-detection ---
  // Derive the dev machine's IP from the Expo host (e.g. "192.168.0.10:8081").
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${DEV_PORT}`;
  }

  // Android emulator reaches the host machine at 10.0.2.2; iOS sim / web use localhost.
  if (Platform.OS === "android") return `http://10.0.2.2:${DEV_PORT}`;
  return `http://localhost:${DEV_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();
