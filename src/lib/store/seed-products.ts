// Default shopping catalog seeded into an empty database so 쇼핑/물품 비교 is
// not empty in dev. Each product carries a few shop offers at different prices
// so the price-comparison view has something to compare. Prices in KRW.
//
// These are illustrative sample links; they are not affiliated endorsements.
export interface SeedProduct {
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  description: string;
  offers: { shop: string; price: number; url: string }[];
}

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "로얄캐닌 미니 어덜트 2kg",
    brand: "로얄캐닌",
    category: "사료",
    imageUrl: "",
    description: "소형견 성견용 건식 사료. 기호성이 좋아 편식하는 아이에게도 인기.",
    offers: [
      { shop: "쿠팡", price: 27900, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 26500, url: "https://shopping.naver.com/" },
      { shop: "댕냥마을샵", price: 28900, url: "https://example.com/" },
    ],
  },
  {
    name: "지위픽 에어드라이 독 96g",
    brand: "지위픽",
    category: "간식",
    imageUrl: "",
    description: "뉴질랜드산 에어드라이 트릿. 훈련 보상용으로 좋은 고단백 간식.",
    offers: [
      { shop: "쿠팡", price: 12800, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 13500, url: "https://shopping.naver.com/" },
    ],
  },
  {
    name: "종근당 프로덴 유산균 60g",
    brand: "종근당바이오",
    category: "영양제",
    imageUrl: "",
    description: "반려동물 장 건강 유산균 분말. 사료에 뿌려주기 간편.",
    offers: [
      { shop: "쿠팡", price: 15900, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 14900, url: "https://shopping.naver.com/" },
      { shop: "댕냥마을샵", price: 16500, url: "https://example.com/" },
    ],
  },
  {
    name: "콩 클래식 노즈워크 장난감 M",
    brand: "KONG",
    category: "장난감",
    imageUrl: "",
    description: "간식을 채워 노즈워크로 즐기는 천연고무 토이. 분리불안 완화에 도움.",
    offers: [
      { shop: "쿠팡", price: 9900, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 8900, url: "https://shopping.naver.com/" },
    ],
  },
  {
    name: "닥터바우 저자극 샴푸 500ml",
    brand: "닥터바우",
    category: "미용/위생",
    imageUrl: "",
    description: "민감성 피부용 약산성 샴푸. 향이 순하고 헹굼이 잘 된다.",
    offers: [
      { shop: "쿠팡", price: 18500, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 17900, url: "https://shopping.naver.com/" },
      { shop: "댕냥마을샵", price: 19900, url: "https://example.com/" },
    ],
  },
  {
    name: "펫세이프 자동급식기 4L",
    brand: "펫세이프",
    category: "용품",
    imageUrl: "",
    description: "타이머 예약 급식이 가능한 자동급식기. 외출이 잦은 집사에게 유용.",
    offers: [
      { shop: "쿠팡", price: 59000, url: "https://www.coupang.com/" },
      { shop: "네이버쇼핑", price: 54900, url: "https://shopping.naver.com/" },
    ],
  },
];
