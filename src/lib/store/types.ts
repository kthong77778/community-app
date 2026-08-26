// Domain models shared across the app.
// Storage-agnostic: the same shapes are returned whether the data comes from
// SQLite today or another SQL database later.

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

// A user object safe to send to the client (no passwordHash).
export interface PublicUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  category: string; // one of POST_CATEGORIES (자랑/질문/후기/홍보)
  authorId: string;
  authorName: string;
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

// A post enriched with counts for list/detail views. Computed in SQL.
export interface PostView extends Post {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

// Result of toggling a like.
export interface LikeState {
  likeCount: number;
  likedByMe: boolean;
}

// A page of posts for the feed.
export interface PostPage {
  posts: PostView[];
  hasMore: boolean;
  nextOffset: number;
}

// ----- Places (map) + reviews -----

// Place types shown on the map: 카페 / 샵 / 호텔 / 병원
export interface Place {
  id: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

// A place enriched with its review aggregates.
export interface PlaceView extends Place {
  reviewCount: number;
  avgRating: number; // 0 when no reviews
}

export interface Review {
  id: string;
  placeId: string;
  authorId: string;
  authorName: string;
  rating: number; // 1..5
  text: string;
  createdAt: string;
}

// ----- Marketplace (중고거래) -----
export interface Item {
  id: string;
  title: string;
  description: string;
  price: number; // KRW
  category: string; // ITEM_CATEGORIES
  status: string; // ITEM_STATUSES (판매중/예약중/판매완료)
  imageUrl: string; // optional; "" when none
  location: string;
  sellerId: string;
  sellerName: string;
  createdAt: string;
  updatedAt: string;
}
