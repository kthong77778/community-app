import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Platform-aware token storage.
//
// - Native (iOS/Android): expo-secure-store (Keychain / Keystore).
// - Web: expo-secure-store is unavailable in the browser, so fall back to
//   localStorage. (Web is used for quick previews; native is the real target.)
//
// All calls are wrapped so a storage failure never crashes the auth flow.

export async function saveToken(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // ignore (private mode, SSR, etc.)
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getToken(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteToken(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
