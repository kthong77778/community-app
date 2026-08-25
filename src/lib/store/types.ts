// Domain models shared across the app.
// These are storage-agnostic: the same shapes are returned whether the data
// comes from the JSON file store today or a real database later.

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
  likedBy: string[]; // user ids who liked this post
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

// A post enriched with counts for list/detail views.
export interface PostView extends Post {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}
