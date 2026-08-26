// Shapes returned by the Next.js backend. Kept in sync with
// ../../src/lib/store/types.ts on the server.

export interface PublicUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface PostView {
  id: string;
  title: string;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// A page of feed posts, as returned by GET /api/posts.
export interface PostPage {
  posts: PostView[];
  hasMore: boolean;
  nextOffset: number;
}

export interface PlaceView {
  id: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  reviewCount: number;
  avgRating: number;
  createdAt: string;
  // Favorite (찜/즐겨찾기) aggregates for the current viewer. Optional so
  // responses without a viewer still type-check.
  favoriteCount?: number;
  favoritedByMe?: boolean;
}

export interface Review {
  id: string;
  placeId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  imageUrl: string;
  location: string;
  sellerId: string;
  sellerName: string;
  createdAt: string;
  updatedAt: string;
  // Favorite (찜) aggregates for the current viewer. Optional so older
  // responses / list endpoints without a viewer still type-check.
  favoriteCount?: number;
  favoritedByMe?: boolean;
}

// 쇼핑/물품 비교 — 카탈로그 상품과 판매처 오퍼.
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  description: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  productId: string;
  shop: string;
  price: number;
  url: string;
  createdAt: string;
}

export interface ProductView extends Product {
  offerCount: number;
  lowestPrice: number; // 0 when no offers
  highestPrice: number; // 0 when no offers
}

// 중고거래 1:1 채팅 — 구매자↔판매자 대화/메시지.
export interface Conversation {
  id: string;
  itemId: string | null;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ConversationView extends Conversation {
  otherUserId: string; // 상대방(표시 이름). 내 id가 아닌 참여자
  itemTitle: string | null; // 상품 삭제 시 null
  itemImageUrl: string | null;
  itemPrice: number | null;
  itemStatus: string | null;
  lastMessageText: string | null;
}
