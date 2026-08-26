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
