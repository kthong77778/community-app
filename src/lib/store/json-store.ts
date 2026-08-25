import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { Store } from "./Store";
import type { Comment, Post, User } from "./types";

interface DbShape {
  users: User[];
  posts: Post[];
  comments: Comment[];
}

const EMPTY_DB: DbShape = { users: [], posts: [], comments: [] };

// A tiny file-backed store.
//
// All reads and writes are serialized through a single promise chain so that
// concurrent requests never interleave a read-modify-write and lose data. This
// is intentionally simple — good enough for local/dev and small demos, and easy
// to replace with a real database implementation of the Store interface.
export class JsonStore implements Store {
  private filePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  // Serialize an operation behind any in-flight operation.
  private run<T>(op: () => Promise<T>): Promise<T> {
    const result = this.queue.then(op, op);
    // Keep the chain alive even if this op rejects.
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async read(): Promise<DbShape> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DbShape>;
      return {
        users: parsed.users ?? [],
        posts: parsed.posts ?? [],
        comments: parsed.comments ?? [],
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...EMPTY_DB };
      }
      throw err;
    }
  }

  private async write(db: DbShape): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(db, null, 2), "utf8");
  }

  // ----- Users -----
  createUser(data: { username: string; passwordHash: string }): Promise<User> {
    return this.run(async () => {
      const db = await this.read();
      const user: User = {
        id: randomUUID(),
        username: data.username,
        passwordHash: data.passwordHash,
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      await this.write(db);
      return user;
    });
  }

  getUserById(id: string): Promise<User | null> {
    return this.run(async () => {
      const db = await this.read();
      return db.users.find((u) => u.id === id) ?? null;
    });
  }

  getUserByUsername(username: string): Promise<User | null> {
    return this.run(async () => {
      const db = await this.read();
      const target = username.toLowerCase();
      return db.users.find((u) => u.username.toLowerCase() === target) ?? null;
    });
  }

  // ----- Posts -----
  createPost(data: {
    title: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Post> {
    return this.run(async () => {
      const db = await this.read();
      const now = new Date().toISOString();
      const post: Post = {
        id: randomUUID(),
        title: data.title,
        content: data.content,
        authorId: data.authorId,
        authorName: data.authorName,
        likedBy: [],
        createdAt: now,
        updatedAt: now,
      };
      db.posts.push(post);
      await this.write(db);
      return post;
    });
  }

  listPosts(): Promise<Post[]> {
    return this.run(async () => {
      const db = await this.read();
      return [...db.posts].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    });
  }

  getPost(id: string): Promise<Post | null> {
    return this.run(async () => {
      const db = await this.read();
      return db.posts.find((p) => p.id === id) ?? null;
    });
  }

  deletePost(id: string): Promise<boolean> {
    return this.run(async () => {
      const db = await this.read();
      const before = db.posts.length;
      db.posts = db.posts.filter((p) => p.id !== id);
      db.comments = db.comments.filter((c) => c.postId !== id);
      const removed = db.posts.length < before;
      if (removed) await this.write(db);
      return removed;
    });
  }

  toggleLike(postId: string, userId: string): Promise<Post | null> {
    return this.run(async () => {
      const db = await this.read();
      const post = db.posts.find((p) => p.id === postId);
      if (!post) return null;
      if (post.likedBy.includes(userId)) {
        post.likedBy = post.likedBy.filter((id) => id !== userId);
      } else {
        post.likedBy.push(userId);
      }
      await this.write(db);
      return post;
    });
  }

  // ----- Comments -----
  addComment(data: {
    postId: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Comment> {
    return this.run(async () => {
      const db = await this.read();
      const comment: Comment = {
        id: randomUUID(),
        postId: data.postId,
        content: data.content,
        authorId: data.authorId,
        authorName: data.authorName,
        createdAt: new Date().toISOString(),
      };
      db.comments.push(comment);
      await this.write(db);
      return comment;
    });
  }

  listComments(postId: string): Promise<Comment[]> {
    return this.run(async () => {
      const db = await this.read();
      return db.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  getCommentById(id: string): Promise<Comment | null> {
    return this.run(async () => {
      const db = await this.read();
      return db.comments.find((c) => c.id === id) ?? null;
    });
  }

  countCommentsByPost(): Promise<Record<string, number>> {
    return this.run(async () => {
      const db = await this.read();
      const counts: Record<string, number> = {};
      for (const c of db.comments) {
        counts[c.postId] = (counts[c.postId] ?? 0) + 1;
      }
      return counts;
    });
  }

  deleteComment(id: string): Promise<boolean> {
    return this.run(async () => {
      const db = await this.read();
      const before = db.comments.length;
      db.comments = db.comments.filter((c) => c.id !== id);
      const removed = db.comments.length < before;
      if (removed) await this.write(db);
      return removed;
    });
  }
}

export const DEFAULT_DB_PATH = join(process.cwd(), "data", "community.json");
