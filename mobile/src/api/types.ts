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
