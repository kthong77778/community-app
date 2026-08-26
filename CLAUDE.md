# 댕냥마을 — 개발 가이드 (에이전트 공용)

반려동물 애호가를 위한 커뮤니티 중심 앱. **커뮤니티 · 지도 · 중고거래** 세 축.

## 4개 표면(surface)을 함께 유지한다

한 기능은 보통 4곳에 동시에 존재한다. 기능을 바꾸면 관련된 표면을 모두 맞춘다.

1. **백엔드** — Next.js API 라우트 (`src/app/api/**`) + 저장소(`src/lib/store/**`)
2. **모바일** — Expo/React Native (`mobile/app/**`, expo-router)
3. **웹** — Next.js 페이지 (`src/app/**/page.tsx`)
4. **프리뷰** — 폰에서 바로 보는 자체완결형 아티팩트. 소스는 세션 스크래치패드의
   `community-preview.html`(localStorage 기반, 저장소 밖). 실제 백엔드엔 붙지 않음.
   변경 시 같은 아티팩트 URL로 재게시.

## 저장소 패턴 (중요)

모든 영속 로직은 `src/lib/store/Store.ts`의 **`Store` 인터페이스** 뒤에 있다.
- 구현체: `src/lib/store/sqlite-store.ts` (better-sqlite3, 트랜잭션, `data/community.db`)
- 접근: 라우트/페이지는 오직 `getStore()`(`src/lib/store/index.ts`)만 사용
- 새 데이터 기능 추가 순서: ① `types.ts`에 도메인 타입 → ② `Store.ts`에 메서드 시그니처
  → ③ `sqlite-store.ts`에 테이블(migrate) + 메서드 + row 매퍼 → ④ `test/store.test.ts`에
  테스트 → ⑤ API 라우트 → ⑥ 모바일/웹 화면
- SQLite 주의: `rowid`는 ORDER BY엔 쓸 수 있어도 **인덱스 컬럼엔 못 쓴다**. 같은 밀리초
  정렬 안정화는 `ORDER BY created_at DESC, rowid DESC`.

## 인증

- **회원가입 없음.** 계정은 `src/lib/accounts.json`에 하드코딩(평문), `src/lib/accounts.ts`가 검증.
- 세션은 **무상태 HMAC 서명 토큰**(`src/lib/auth.ts`) — DB 불필요. 웹=httpOnly 쿠키,
  모바일=`Authorization: Bearer`. `getCurrentUser()`가 둘 다 인식하고 `{id, username}` 반환
  (id = username). 로그인 라우트에 rate limit(`src/lib/rateLimit.ts`).
- `/api/*`엔 CORS 미들웨어(`src/middleware.ts`).

## 검증 (커밋 전 항상)

- 백엔드/웹: `npm run build` · `npm test`(저장소 유닛테스트)
- 모바일: `cd mobile && npx tsc --noEmit` · `npx expo export --platform ios`(번들 확인)
- 이 환경은 백그라운드 서버 기동이 불안정하니 런타임 스모크는 실패할 수 있음 — 빌드+테스트로 대체.
- `data/community.db*`는 커밋 금지(.gitignore). `mobile/expo-env.d.ts`는 커밋 유지(신규 클론 타입체크용);
  `expo start/export`가 삭제하면 복원.

## 디자인 토큰 (댕냥마을: 따뜻한 코랄/크림)

- 모바일: `mobile/src/theme.ts` (`colors`, 카테고리/장소/상품 이모지·색 헬퍼)
- 웹: `src/app/globals.css` (`:root` 토큰, 라이트/다크)

## 기능별 파일 지도

### 커뮤니티(홈/피드) — 게시글·댓글·좋아요, 카테고리(자랑/질문/후기/홍보)
- 백엔드: `src/app/api/posts/**`, `src/app/api/comments/[id]/route.ts`; posts/comments/likes 관련 Store 메서드
- 웹: `src/app/page.tsx`, `src/app/posts/[id]/page.tsx`, `src/app/posts/new/page.tsx`
- 모바일: `mobile/app/feed.tsx`, `mobile/app/post/[id].tsx`, `mobile/app/new.tsx`

### 지도 — 장소(카페/샵/호텔/병원)·리뷰(별점)·길찾기(카카오/네이버/티맵/구글)
- 백엔드: `src/app/api/places/**`, `src/lib/store/seed-places.ts`(기본 장소 시드), `src/lib/placeTypes.ts`, `src/lib/mapLinks.ts`
- 웹: `src/app/map/page.tsx`, `src/app/places/[id]/page.tsx`, `src/components/PlacesMap.tsx`(Leaflet/OSM, CDN)
- 모바일: `mobile/app/map.tsx`(WebView+Leaflet), `mobile/app/place/[id].tsx`, `mobile/src/lib/directions.ts`(expo-linking)
- 실제 지도 타일은 키 없는 OpenStreetMap. 길찾기 딥링크는 키 불필요.

### 중고거래 — 상품(상태: 판매중/예약중/판매완료), 카테고리, 판매등록
- 백엔드: `src/app/api/items/**`, `src/lib/marketplace.ts`(카테고리/상태 상수)
- 웹: `src/app/items/page.tsx`, `src/app/items/[id]/page.tsx`, `src/app/sell/page.tsx`, `src/lib/itemDisplay.ts`
- 모바일: `mobile/app/market.tsx`, `mobile/app/item/[id].tsx`, `mobile/app/sell.tsx`
- 이미지는 선택(사진 URL); 없으면 카테고리 이모지. 파일 업로드는 배포 시 스토리지 필요.

### 공통 네비/인프라
- 모바일 하단탭: `mobile/src/components/BottomNav.tsx`(커뮤니티/지도/중고거래, `replace`), 화면 등록: `mobile/app/_layout.tsx`
- 모바일 API/인증: `mobile/src/api/client.ts`(PATCH 포함), `mobile/src/api/types.ts`, `mobile/src/auth/AuthContext.tsx`
- 웹 헤더/인증: `src/components/Header.tsx`, `src/components/AuthProvider.tsx`

## 로드맵

커뮤니티 ✅ · 지도 ✅ · 중고거래 ✅ · **쇼핑/물품 비교(예정)**. 배포는 마지막 단계
(영속 디스크 호스트면 SQLite 그대로, 서버리스면 PostgresStore로 교체).
