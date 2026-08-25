import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import type { Store } from "./Store";
import type {
  Comment,
  LikeState,
  Post,
  PostPage,
  PostView,
  User,
} from "./types";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// SQLite-backed store using better-sqlite3 (synchronous, transactional).
//
// This fixes the problems of the earlier JSON-file store:
//   - Real transactions + a UNIQUE constraint make username creation atomic
//     (no check-then-insert race).
//   - Likes and comments are normalized tables; counts are computed in SQL
//     instead of loading every row.
//   - Sessions live in a table, so logout truly revokes a token.
//
// Persists to a file on disk, so it works on any host with a persistent volume
// (Railway, Render, Fly, a VM, Docker). For serverless (e.g. Vercel), implement
// the same Store interface against a managed Postgres instead.
export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      mkdirSync(dirname(filePath), { recursive: true });
    }
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_lower TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS likes (
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
    `);
  }

  // ----- Users -----
  async createUser(data: {
    username: string;
    passwordHash: string;
  }): Promise<User | null> {
    const user: User = {
      id: randomUUID(),
      username: data.username,
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString(),
    };
    try {
      this.db
        .prepare(
          `INSERT INTO users (id, username, username_lower, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          user.id,
          user.username,
          user.username.toLowerCase(),
          user.passwordHash,
          user.createdAt,
        );
      return user;
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        return null; // username taken
      }
      throw err;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    return row ? this.mapUser(row) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE username_lower = ?`)
      .get(username.toLowerCase());
    return row ? this.mapUser(row) : null;
  }

  // ----- Sessions -----
  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        hashToken(token),
        userId,
        new Date(now).toISOString(),
        new Date(now + SESSION_TTL_MS).toISOString(),
      );
    return token;
  }

  async getSessionUser(token: string): Promise<User | null> {
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(hashToken(token), new Date().toISOString());
    return row ? this.mapUser(row) : null;
  }

  async deleteSession(token: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM sessions WHERE token_hash = ?`)
      .run(hashToken(token));
  }

  // ----- Posts -----
  async createPost(data: {
    title: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<PostView> {
    const now = new Date().toISOString();
    const post: Post = {
      id: randomUUID(),
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO posts (id, title, content, author_id, author_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        post.id,
        post.title,
        post.content,
        post.authorId,
        post.authorName,
        post.createdAt,
        post.updatedAt,
      );
    return { ...post, likeCount: 0, commentCount: 0, likedByMe: false };
  }

  async listPostViews(opts: {
    limit: number;
    offset: number;
    currentUserId: string | null;
  }): Promise<PostPage> {
    const { limit, offset, currentUserId } = opts;
    // Fetch one extra row to determine whether more pages exist.
    const rows = this.db
      .prepare(
        // rowid (insert order) breaks ties when created_at collides in the
        // same millisecond, keeping the order stable and deterministic.
        `${POST_VIEW_SELECT}
         ORDER BY p.created_at DESC, p.rowid DESC
         LIMIT ? OFFSET ?`,
      )
      .all(currentUserId ?? "", limit + 1, offset) as PostViewRow[];

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map(mapPostView);
    return { posts: page, hasMore, nextOffset: offset + page.length };
  }

  async getPostView(
    id: string,
    currentUserId: string | null,
  ): Promise<PostView | null> {
    const row = this.db
      .prepare(`${POST_VIEW_SELECT} WHERE p.id = ?`)
      .get(currentUserId ?? "", id) as PostViewRow | undefined;
    return row ? mapPostView(row) : null;
  }

  async getPost(id: string): Promise<Post | null> {
    const row = this.db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    return row ? mapPost(row as PostRow) : null;
  }

  async deletePost(id: string): Promise<boolean> {
    const info = this.db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<LikeState | null> {
    const toggle = this.db.transaction((): LikeState | null => {
      const exists = this.db
        .prepare(`SELECT 1 FROM posts WHERE id = ?`)
        .get(postId);
      if (!exists) return null;

      const liked = this.db
        .prepare(`SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?`)
        .get(postId, userId);

      if (liked) {
        this.db
          .prepare(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`)
          .run(postId, userId);
      } else {
        this.db
          .prepare(
            `INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)`,
          )
          .run(postId, userId, new Date().toISOString());
      }

      const { c } = this.db
        .prepare(`SELECT COUNT(*) AS c FROM likes WHERE post_id = ?`)
        .get(postId) as { c: number };
      return { likeCount: c, likedByMe: !liked };
    });
    return toggle();
  }

  // ----- Comments -----
  async addComment(data: {
    postId: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Comment> {
    const comment: Comment = {
      id: randomUUID(),
      postId: data.postId,
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO comments (id, post_id, content, author_id, author_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        comment.id,
        comment.postId,
        comment.content,
        comment.authorId,
        comment.authorName,
        comment.createdAt,
      );
    return comment;
  }

  async listComments(postId: string): Promise<Comment[]> {
    const rows = this.db
      .prepare(
        // rowid (insert order) is the tie-breaker for same-millisecond comments.
        `SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC, rowid ASC`,
      )
      .all(postId) as CommentRow[];
    return rows.map(mapComment);
  }

  async getCommentById(id: string): Promise<Comment | null> {
    const row = this.db
      .prepare(`SELECT * FROM comments WHERE id = ?`)
      .get(id) as CommentRow | undefined;
    return row ? mapComment(row) : null;
  }

  async deleteComment(id: string): Promise<boolean> {
    const info = this.db.prepare(`DELETE FROM comments WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  // Housekeeping: drop expired sessions. Safe to call periodically.
  deleteExpiredSessions(): void {
    this.db
      .prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
      .run(new Date().toISOString());
  }

  private mapUser(row: unknown): User {
    const r = row as UserRow;
    return {
      id: r.id,
      username: r.username,
      passwordHash: r.password_hash,
      createdAt: r.created_at,
    };
  }
}

// ----- Row shapes + mappers (snake_case DB -> camelCase domain) -----

interface UserRow {
  id: string;
  username: string;
  username_lower: string;
  password_hash: string;
  created_at: string;
}
interface PostRow {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}
interface PostViewRow extends PostRow {
  like_count: number;
  comment_count: number;
  liked_by_me: number;
}
interface CommentRow {
  id: string;
  post_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

const POST_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
    EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = ?) AS liked_by_me
  FROM posts p`;

function mapPost(r: PostRow): Post {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    authorId: r.author_id,
    authorName: r.author_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPostView(r: PostViewRow): PostView {
  return {
    ...mapPost(r),
    likeCount: r.like_count,
    commentCount: r.comment_count,
    likedByMe: r.liked_by_me === 1,
  };
}

function mapComment(r: CommentRow): Comment {
  return {
    id: r.id,
    postId: r.post_id,
    content: r.content,
    authorId: r.author_id,
    authorName: r.author_name,
    createdAt: r.created_at,
  };
}

export const DEFAULT_DB_PATH = join(process.cwd(), "data", "community.db");
