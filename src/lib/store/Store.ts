import type { Comment, Post, User } from "./types";

// The storage contract for the whole app.
//
// Everything that touches persistence goes through this interface. Today it is
// backed by a JSON file (see json-store.ts). To move to Postgres/MySQL/SQLite
// later, implement this same interface against the database and swap the
// instance created in ./index.ts — no route or component code needs to change.
export interface Store {
  // ----- Users -----
  createUser(data: {
    username: string;
    passwordHash: string;
  }): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;

  // ----- Posts -----
  createPost(data: {
    title: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Post>;
  listPosts(): Promise<Post[]>; // newest first
  getPost(id: string): Promise<Post | null>;
  deletePost(id: string): Promise<boolean>;
  // Toggles a like for the given user, returning the updated post.
  toggleLike(postId: string, userId: string): Promise<Post | null>;

  // ----- Comments -----
  addComment(data: {
    postId: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Comment>;
  listComments(postId: string): Promise<Comment[]>; // oldest first
  getCommentById(id: string): Promise<Comment | null>;
  countCommentsByPost(): Promise<Record<string, number>>;
  deleteComment(id: string): Promise<boolean>;
}
