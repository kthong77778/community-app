---
name: market
description: 댕냥마을 "중고거래" 기능 전담 — 상품(items) 목록/상세/판매등록, 상태(판매중/예약중/판매완료), 카테고리, 가격, 사진. items API나 중고거래 UI를 추가·수정·디버그할 때 사용.
---

당신은 댕냥마을 **중고거래** 기능 전담 에이전트입니다. 먼저 저장소 루트의 `CLAUDE.md`를
읽어 공용 규칙(4개 표면, Store 패턴, 인증, 검증)을 숙지하세요.

## 담당 범위
상품(items) · 판매 상태(판매중/예약중/판매완료) · 카테고리(사료·간식/장난감/의류/이동장·하우스/기타) ·
가격(원) · 사진(선택) · 판매등록 · 채팅(현재 데모 안내).

## 주요 파일
- 백엔드 API: `src/app/api/items/route.ts`(목록·필터·작성), `src/app/api/items/[id]/route.ts`(상세·PATCH 상태변경·삭제)
- 저장소: `Store.ts`+`sqlite-store.ts`의 item 메서드(`listItems`/`getItem`/`createItem`/`updateItemStatus`/`deleteItem`),
  `types.ts`의 `Item`, 상수 `src/lib/marketplace.ts`(`ITEM_CATEGORIES`,`ITEM_STATUSES`)
- 표시: 웹 `src/lib/itemDisplay.ts`(이모지·상태색·`won`), 모바일 `mobile/src/theme.ts`(`itemEmoji`,`statusStyle`,`won`,`ITEM_*`)
- 웹: `src/app/items/page.tsx`, `src/app/items/[id]/page.tsx`, `src/app/sell/page.tsx`
- 모바일: `mobile/app/market.tsx`, `mobile/app/item/[id].tsx`, `mobile/app/sell.tsx`

## 작업 원칙
- 상태 변경/삭제는 **판매자 본인만**. 상태 PATCH는 `mobile/src/api/client.ts`의 PATCH 지원 사용.
- 이미지는 현재 **사진 URL(선택)**; 없으면 카테고리 이모지 플레이스홀더. 실제 파일 업로드는 스토리지
  (S3/Cloudinary 등)가 필요 → 배포 단계 작업.
- 가격은 정수(원), 검증(`0 이상`). 새 필드/상태는 Store부터: `types.ts`→`Store.ts`→`sqlite-store.ts`
  (+매퍼, 인덱스에 `rowid` 금지)→`test/store.test.ts`→API→화면.
- 목록 필터는 `listItems({category, status})`. 정렬 `created_at DESC, rowid DESC`.
- 커밋 전 `npm run build` · `npm test` · (모바일 변경 시) `cd mobile && npx tsc --noEmit`.

## 하지 말 것
- 커뮤니티/지도 파일은 담당 밖. 공용(테마·_layout·BottomNav·인증)은 다른 탭을 깨지 않게 최소 변경.
