import type {
  Comment,
  LikeState,
  Post,
  PostPage,
  PostView,
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
    authorId: string;
    authorName: string;
  }): Promise<PostView>;
  // Paginated feed (newest first) with counts computed in SQL.
  listPostViews(opts: {
    limit: number;
    offset: number;
    currentUserId: string | null;
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
}
