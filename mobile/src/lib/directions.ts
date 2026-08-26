import { Alert, Linking } from "react-native";

// 4개 지도 앱 길찾기 딥링크 — API 키가 필요 없습니다.
//  카카오맵 / 네이버지도 / 티맵 / 구글지도
export interface MapProvider {
  key: "kakao" | "naver" | "tmap" | "google";
  label: string;
  color: string;
}

export const MAP_PROVIDERS: MapProvider[] = [
  { key: "kakao", label: "카카오맵", color: "#FEE500" },
  { key: "naver", label: "네이버지도", color: "#03C75A" },
  { key: "tmap", label: "티맵", color: "#EB1D25" },
  { key: "google", label: "구글지도", color: "#4285F4" },
];

interface Target {
  name: string;
  lat: number;
  lng: number;
}

// Returns [primary app URL, web/fallback URL] for a provider.
function urlsFor(key: MapProvider["key"], t: Target): [string, string | null] {
  const q = encodeURIComponent(t.name);
  switch (key) {
    case "kakao":
      return [`https://map.kakao.com/link/to/${q},${t.lat},${t.lng}`, null];
    case "naver":
      return [
        `nmap://route/car?dlat=${t.lat}&dlng=${t.lng}&dname=${q}&appname=com.communityapp.mobile`,
        `https://map.naver.com/p/search/${q}`,
      ];
    case "tmap":
      return [`tmap://route?goalname=${q}&goalx=${t.lng}&goaly=${t.lat}`, null];
    case "google":
      return [
        `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`,
        null,
      ];
  }
}

// Opens the chosen map app, falling back to a web link (or an alert) when the
// app is not installed.
export async function openDirections(
  key: MapProvider["key"],
  t: Target,
): Promise<void> {
  const [primary, fallback] = urlsFor(key, t);
  try {
    if (await Linking.canOpenURL(primary)) {
      await Linking.openURL(primary);
      return;
    }
  } catch {
    // fall through to fallback
  }
  if (fallback) {
    await Linking.openURL(fallback);
  } else {
    Alert.alert("앱을 열 수 없어요", "해당 지도 앱이 설치되어 있는지 확인해 주세요.");
  }
}
