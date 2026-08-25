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
