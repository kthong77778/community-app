// Default shopping catalog seeded into an empty database so 쇼핑/물품 비교 is
// not empty in dev. Each product carries a few shop offers at different prices
// so the price-comparison view has something to compare. Prices in KRW.
//
// Offer links point at each shop's SEARCH results for the product name (not the
// shop homepage), so "구매하러 가기" lands on a real product listing. Swap these
// for affiliate/deep links when integrating a real shopping source.
export interface SeedProduct {
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  description: string;
  offers: { shop: string; price: number; url: string }[];
}

// Builds a shop's search-results URL for the product name.
function searchUrl(shop: string, query: string): string {
  const q = encodeURIComponent(query);
  if (shop === "쿠팡") return `https://www.coupang.com/np/search?q=${q}`;
  if (shop === "네이버쇼핑")
    return `https://search.shopping.naver.com/search/all?query=${q}`;
  return `https://www.google.com/search?q=${q}`; // 댕냥마을샵 등 기타 판매처
}

function product(
  name: string,
  brand: string,
  category: string,
  description: string,
  priced: [string, number][],
): SeedProduct {
  return {
    name,
    brand,
    category,
    imageUrl: "",
    description,
    offers: priced.map(([shop, price]) => ({
      shop,
      price,
      url: searchUrl(shop, name),
    })),
  };
}

export const SEED_PRODUCTS: SeedProduct[] = [
  product(
    "로얄캐닌 미니 어덜트 2kg",
    "로얄캐닌",
    "사료",
    "소형견 성견용 건식 사료. 기호성이 좋아 편식하는 아이에게도 인기.",
    [["쿠팡", 27900], ["네이버쇼핑", 26500], ["댕냥마을샵", 28900]],
  ),
  product(
    "지위픽 에어드라이 독 96g",
    "지위픽",
    "간식",
    "뉴질랜드산 에어드라이 트릿. 훈련 보상용으로 좋은 고단백 간식.",
    [["쿠팡", 12800], ["네이버쇼핑", 13500]],
  ),
  product(
    "종근당 프로덴 유산균 60g",
    "종근당바이오",
    "영양제",
    "반려동물 장 건강 유산균 분말. 사료에 뿌려주기 간편.",
    [["쿠팡", 15900], ["네이버쇼핑", 14900], ["댕냥마을샵", 16500]],
  ),
  product(
    "콩 클래식 노즈워크 장난감 M",
    "KONG",
    "장난감",
    "간식을 채워 노즈워크로 즐기는 천연고무 토이. 분리불안 완화에 도움.",
    [["쿠팡", 9900], ["네이버쇼핑", 8900]],
  ),
  product(
    "닥터바우 저자극 샴푸 500ml",
    "닥터바우",
    "미용/위생",
    "민감성 피부용 약산성 샴푸. 향이 순하고 헹굼이 잘 된다.",
    [["쿠팡", 18500], ["네이버쇼핑", 17900], ["댕냥마을샵", 19900]],
  ),
  product(
    "펫세이프 자동급식기 4L",
    "펫세이프",
    "용품",
    "타이머 예약 급식이 가능한 자동급식기. 외출이 잦은 집사에게 유용.",
    [["쿠팡", 59000], ["네이버쇼핑", 54900]],
  ),
];
