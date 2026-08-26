import type {
  Comment,
  Conversation,
  ConversationView,
  Item,
  ItemFavoriteState,
  ItemView,
  LikeState,
  Message,
  Offer,
  Place,
  PlaceFavoriteState,
  PlaceView,
  Post,
  PostPage,
  PostView,
  Product,
  ProductView,
  Review,
  User,
} from "./types";

// The storage contract for the whole app.
//
// Everything that touches persistence goes through this interface. It is backed
// by SQLite today (see sqlite-store.ts). To move to Postgres/MySQL later,
// implement this same interface against that database and swap the instance
// created in ./index.ts — no route or component code changes.
export interface Store {
  // ----- Users -----
  // Creates a user. Returns null if the username is already taken — the
  // uniqueness check and insert happen atomically (no race).
  createUser(data: {
    username: string;
    passwordHash: string;
  }): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;

  // ----- Sessions (server-side, revocable) -----
  // Creates a session for a user and returns the opaque bearer token.
  createSession(userId: string): Promise<string>;
  // Resolves a token to its user, or null if missing/expired/revoked.
  getSessionUser(token: string): Promise<User | null>;
  // Revokes a single session (logout).
  deleteSession(token: string): Promise<void>;

  // ----- Posts -----
  createPost(data: {
    title: string;
    content: string;
    category: string;
    authorId: string;
    authorName: string;
  }): Promise<PostView>;
  // Paginated feed (newest first) with counts computed in SQL.
  // Pass `category` to filter to a single category.
  listPostViews(opts: {
    limit: number;
    offset: number;
    currentUserId: string | null;
    category?: string | null;
  }): Promise<PostPage>;
  getPostView(id: string, currentUserId: string | null): Promise<PostView | null>;
  getPost(id: string): Promise<Post | null>;
  deletePost(id: string): Promise<boolean>;
  // Toggles a like for the user; returns the updated counts, or null if the
  // post does not exist.
  toggleLike(postId: string, userId: string): Promise<LikeState | null>;

  // ----- Comments -----
  addComment(data: {
    postId: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Comment>;
  listComments(postId: string): Promise<Comment[]>; // oldest first
  getCommentById(id: string): Promise<Comment | null>;
  deleteComment(id: string): Promise<boolean>;

  // ----- Places (map) -----
  // Lists places (optionally filtered by type) with review + favorite
  // aggregates. Pass `currentUserId` so `favoritedByMe` reflects that viewer's
  // 찜 state (null → always false).
  listPlaces(
    type?: string | null,
    currentUserId?: string | null,
  ): Promise<PlaceView[]>;
  getPlace(id: string, currentUserId?: string | null): Promise<PlaceView | null>;
  createPlace(data: {
    name: string;
    type: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<PlaceView>;

  // Toggles the user's 찜(favorite/즐겨찾기) for a place; returns the new state,
  // or null if the place does not exist. Runs in a transaction.
  togglePlaceFavorite(
    userId: string,
    placeId: string,
  ): Promise<PlaceFavoriteState | null>;
  // Lists the places the user has favorited, most-recently-favorited first.
  listFavoritePlaces(userId: string): Promise<PlaceView[]>;

  // ----- Reviews -----
  addReview(data: {
    placeId: string;
    authorId: string;
    authorName: string;
    rating: number;
    text: string;
  }): Promise<Review>;
  listReviews(placeId: string): Promise<Review[]>; // newest first
  getReviewById(id: string): Promise<Review | null>;
  deleteReview(id: string): Promise<boolean>;

  // ----- Marketplace (중고거래) -----
  // Lists listings (newest first) with favorite aggregates. Pass `currentUserId`
  // to have `favoritedByMe` reflect that viewer's 찜 state (null → always false).
  listItems(opts?: {
    category?: string | null;
    status?: string | null;
    currentUserId?: string | null;
  }): Promise<ItemView[]>; // newest first
  getItem(id: string, currentUserId?: string | null): Promise<ItemView | null>;
  createItem(data: {
    title: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    location: string;
    sellerId: string;
    sellerName: string;
  }): Promise<Item>;
  updateItemStatus(id: string, status: string): Promise<Item | null>;
  deleteItem(id: string): Promise<boolean>;

  // Toggles the user's 찜(favorite) for an item; returns the new state, or null
  // if the item does not exist. Runs in a transaction.
  toggleItemFavorite(
    userId: string,
    itemId: string,
  ): Promise<ItemFavoriteState | null>;
  // Lists the items the user has favorited, most-recently-favorited first.
  listFavoriteItems(userId: string): Promise<ItemView[]>;

  // ----- Shopping (쇼핑/물품 비교) -----
  // Lists catalog products with price-comparison aggregates. `sort` is
  // "lowest" (최저가순) or "latest" (최신순, default).
  listProducts(opts?: {
    category?: string | null;
    sort?: "lowest" | "latest";
  }): Promise<ProductView[]>;
  getProduct(id: string): Promise<ProductView | null>;
  // Offers for a product, cheapest first.
  listOffers(productId: string): Promise<Offer[]>;
  createProduct(data: {
    name: string;
    brand: string;
    category: string;
    imageUrl: string;
    description: string;
  }): Promise<Product>;
  addOffer(data: {
    productId: string;
    shop: string;
    price: number;
    url: string;
  }): Promise<Offer>;

  // ----- Chat (1:1 메시지) -----
  // Returns the existing (itemId, buyerId, sellerId) conversation or creates it.
  // Runs in a transaction so concurrent "채팅하기" taps don't duplicate a thread.
  getOrCreateConversation(data: {
    itemId: string | null;
    buyerId: string;
    sellerId: string;
  }): Promise<Conversation>;
  // Conversations the user takes part in (buyer or seller), most-recent first,
  // enriched with the other participant + item summary + last message.
  listConversations(userId: string): Promise<ConversationView[]>;
  // A single conversation the user takes part in, or null if missing / not a
  // participant (so callers can 404 non-members).
  getConversationForUser(
    id: string,
    userId: string,
  ): Promise<ConversationView | null>;
  listMessages(conversationId: string): Promise<Message[]>; // oldest first
  // Appends a message and bumps the conversation's lastMessageAt (transaction).
  sendMessage(data: {
    conversationId: string;
    senderId: string;
    text: string;
  }): Promise<Message>;
  // Marks the conversation read up to now for the given participant. No-op if
  // the user isn't a participant.
  markConversationRead(conversationId: string, userId: string): Promise<void>;
  // Total unread messages across all the user's conversations (for a nav badge).
  getTotalUnread(userId: string): Promise<number>;
}
