// Default places seeded into an empty database so the map is not empty in dev.
// Coordinates are approximate Seoul locations.
export const SEED_PLACES = [
  { name: "멍멍이 카페", type: "카페", address: "서울 마포구 연남로 12", lat: 37.5626, lng: 126.925 },
  { name: "냥이라운지 카페", type: "카페", address: "서울 성동구 왕십리로 5", lat: 37.5613, lng: 127.037 },
  { name: "댕댕 펫샵", type: "샵", address: "서울 마포구 동교로 34", lat: 37.557, lng: 126.923 },
  { name: "포근 펫호텔", type: "호텔", address: "서울 용산구 이태원로 88", lat: 37.534, lng: 126.9948 },
  { name: "튼튼 동물병원", type: "병원", address: "서울 마포구 성미산로 21", lat: 37.556, lng: 126.911 },
  { name: "24시 반려동물 의료센터", type: "병원", address: "서울 성동구 성수일로 9", lat: 37.5445, lng: 127.056 },
];

// Allowed place types.
export const PLACE_TYPES = ["카페", "샵", "호텔", "병원"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];
