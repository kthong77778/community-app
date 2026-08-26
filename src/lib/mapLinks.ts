// 4개 지도 앱 길찾기 링크 (API 키 불필요). 웹에서는 https 링크가 앱/브라우저를
// 열고, 티맵은 앱 스킴을 사용합니다.
export interface MapLink {
  key: string;
  label: string;
  color: string;
  url: string;
}

export function mapLinks(name: string, lat: number, lng: number): MapLink[] {
  const q = encodeURIComponent(name);
  return [
    { key: "kakao", label: "카카오맵", color: "#FEE500", url: `https://map.kakao.com/link/to/${q},${lat},${lng}` },
    { key: "naver", label: "네이버지도", color: "#03C75A", url: `https://map.naver.com/p/search/${q}` },
    { key: "tmap", label: "티맵", color: "#EB1D25", url: `tmap://route?goalname=${q}&goalx=${lng}&goaly=${lat}` },
    { key: "google", label: "구글지도", color: "#4285F4", url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
  ];
}
