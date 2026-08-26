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

// A place enriched with its review aggregates and, for the current viewer,
// favorite (찜/즐겨찾기) aggregates. Computed in SQL.
export interface PlaceView extends Place {
  reviewCount: number;
  avgRating: number; // 0 when no reviews
  favoriteCount: number;
  favoritedByMe: boolean;
}

// Result of toggling a place favorite.
export interface PlaceFavoriteState {
  favorited: boolean;
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

// An item enriched with favorite (찜) aggregates for list/detail views.
// Computed in SQL relative to the current viewer (favoritedByMe).
export interface ItemView extends Item {
  favoriteCount: number;
  favoritedByMe: boolean;
}

// Result of toggling an item favorite.
export interface ItemFavoriteState {
  favorited: boolean;
}

// ----- Shopping (쇼핑/물품 비교) -----
// A catalog product (신품) whose price is compared across multiple shops.
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string; // PRODUCT_CATEGORIES
  imageUrl: string; // optional; "" when none
  description: string;
  createdAt: string;
}

// A single shop's price offer for a product, with an outbound link.
export interface Offer {
  id: string;
  productId: string;
  shop: string; // 판매처 이름 (쿠팡/네이버 등)
  price: number; // KRW
  url: string; // outbound product link
  createdAt: string;
}

// A product enriched with price-comparison aggregates across its offers.
export interface ProductView extends Product {
  offerCount: number;
  lowestPrice: number; // 0 when no offers
  highestPrice: number; // 0 when no offers
}

// ----- Chat (1:1 메시지) -----
// A buyer↔seller conversation, optionally scoped to a marketplace item.
// buyerId/sellerId are user ids (= usernames).
export interface Conversation {
  id: string;
  itemId: string | null; // null if the item was deleted or a general chat
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

// A conversation enriched for list/detail, relative to the viewing user:
// the other participant plus a summary of the linked item and last message.
export interface ConversationView extends Conversation {
  otherUserId: string; // the participant who isn't the viewer (display name)
  itemTitle: string | null; // null when the item was deleted
  itemImageUrl: string | null;
  itemPrice: number | null;
  itemStatus: string | null;
  lastMessageText: string | null; // null when no messages yet
}
