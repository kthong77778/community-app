import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import type { Store } from "./Store";
import type {
  Comment,
  Item,
  LikeState,
  Place,
  PlaceView,
  Post,
  PostPage,
  PostView,
  Review,
  User,
} from "./types";
import { SEED_PLACES } from "./seed-places";

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
        category TEXT NOT NULL DEFAULT '자랑',
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category, created_at DESC);

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

      CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_places_type ON places(type);

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id, created_at);

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT '판매중',
        image_url TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        seller_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    `);

    // Additive column migrations for databases created before a column existed.
    this.addColumnIfMissing("posts", "category", "TEXT NOT NULL DEFAULT '자랑'");

    this.seedPlacesIfEmpty();
  }

  private seedPlacesIfEmpty(): void {
    const { c } = this.db.prepare(`SELECT COUNT(*) AS c FROM places`).get() as {
      c: number;
    };
    if (c > 0) return;
    const now = new Date().toISOString();
    const insert = this.db.prepare(
      `INSERT INTO places (id, name, type, address, lat, lng, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const seed = this.db.transaction(() => {
      for (const p of SEED_PLACES) {
        insert.run(randomUUID(), p.name, p.type, p.address, p.lat, p.lng, now);
      }
    });
    seed();
  }

  private addColumnIfMissing(table: string, column: string, decl: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
    }[];
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
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
    category: string;
    authorId: string;
    authorName: string;
  }): Promise<PostView> {
    const now = new Date().toISOString();
    const post: Post = {
      id: randomUUID(),
      title: data.title,
      content: data.content,
      category: data.category,
      authorId: data.authorId,
      authorName: data.authorName,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO posts (id, title, content, category, author_id, author_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        post.id,
        post.title,
        post.content,
        post.category,
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
    category?: string | null;
  }): Promise<PostPage> {
    const { limit, offset, currentUserId, category } = opts;
    const where = category ? `WHERE p.category = ?` : ``;
    const params: (string | number)[] = [currentUserId ?? ""];
    if (category) params.push(category);
    params.push(limit + 1, offset);

    // Fetch one extra row to determine whether more pages exist.
    // rowid (insert order) breaks ties when created_at collides in the same
    // millisecond, keeping the order stable and deterministic.
    const rows = this.db
      .prepare(
        `${POST_VIEW_SELECT}
         ${where}
         ORDER BY p.created_at DESC, p.rowid DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params) as PostViewRow[];

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

  // ----- Places -----
  async listPlaces(type?: string | null): Promise<PlaceView[]> {
    const where = type ? `WHERE p.type = ?` : ``;
    const rows = this.db
      .prepare(`${PLACE_VIEW_SELECT} ${where} ORDER BY p.rowid ASC`)
      .all(...(type ? [type] : [])) as PlaceViewRow[];
    return rows.map(mapPlaceView);
  }

  async getPlace(id: string): Promise<PlaceView | null> {
    const row = this.db
      .prepare(`${PLACE_VIEW_SELECT} WHERE p.id = ?`)
      .get(id) as PlaceViewRow | undefined;
    return row ? mapPlaceView(row) : null;
  }

  async createPlace(data: {
    name: string;
    type: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<PlaceView> {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO places (id, name, type, address, lat, lng, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, data.name, data.type, data.address, data.lat, data.lng, new Date().toISOString());
    return (await this.getPlace(id))!;
  }

  // ----- Reviews -----
  async addReview(data: {
    placeId: string;
    authorId: string;
    authorName: string;
    rating: number;
    text: string;
  }): Promise<Review> {
    const review: Review = {
      id: randomUUID(),
      placeId: data.placeId,
      authorId: data.authorId,
      authorName: data.authorName,
      rating: data.rating,
      text: data.text,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO reviews (id, place_id, author_id, author_name, rating, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        review.id,
        review.placeId,
        review.authorId,
        review.authorName,
        review.rating,
        review.text,
        review.createdAt,
      );
    return review;
  }

  async listReviews(placeId: string): Promise<Review[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM reviews WHERE place_id = ? ORDER BY created_at DESC, rowid DESC`,
      )
      .all(placeId) as ReviewRow[];
    return rows.map(mapReview);
  }

  async getReviewById(id: string): Promise<Review | null> {
    const row = this.db
      .prepare(`SELECT * FROM reviews WHERE id = ?`)
      .get(id) as ReviewRow | undefined;
    return row ? mapReview(row) : null;
  }

  async deleteReview(id: string): Promise<boolean> {
    const info = this.db.prepare(`DELETE FROM reviews WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  // ----- Marketplace -----
  async listItems(opts?: {
    category?: string | null;
    status?: string | null;
  }): Promise<Item[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    if (opts?.category) {
      clauses.push("category = ?");
      params.push(opts.category);
    }
    if (opts?.status) {
      clauses.push("status = ?");
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT * FROM items ${where} ORDER BY created_at DESC, rowid DESC`,
      )
      .all(...params) as ItemRow[];
    return rows.map(mapItem);
  }

  async getItem(id: string): Promise<Item | null> {
    const row = this.db
      .prepare(`SELECT * FROM items WHERE id = ?`)
      .get(id) as ItemRow | undefined;
    return row ? mapItem(row) : null;
  }

  async createItem(data: {
    title: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    location: string;
    sellerId: string;
    sellerName: string;
  }): Promise<Item> {
    const now = new Date().toISOString();
    const item: Item = {
      id: randomUUID(),
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
      status: "판매중",
      imageUrl: data.imageUrl,
      location: data.location,
      sellerId: data.sellerId,
      sellerName: data.sellerName,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO items (id, title, description, price, category, status, image_url, location, seller_id, seller_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        item.title,
        item.description,
        item.price,
        item.category,
        item.status,
        item.imageUrl,
        item.location,
        item.sellerId,
        item.sellerName,
        item.createdAt,
        item.updatedAt,
      );
    return item;
  }

  async updateItemStatus(id: string, status: string): Promise<Item | null> {
    const info = this.db
      .prepare(`UPDATE items SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), id);
    if (info.changes === 0) return null;
    return this.getItem(id);
  }

  async deleteItem(id: string): Promise<boolean> {
    const info = this.db.prepare(`DELETE FROM items WHERE id = ?`).run(id);
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
  category: string;
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
    category: r.category,
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

interface PlaceRow {
  id: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}
interface PlaceViewRow extends PlaceRow {
  review_count: number;
  avg_rating: number | null;
}
interface ReviewRow {
  id: string;
  place_id: string;
  author_id: string;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
}

const PLACE_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM reviews r WHERE r.place_id = p.id) AS review_count,
    (SELECT AVG(r.rating) FROM reviews r WHERE r.place_id = p.id) AS avg_rating
  FROM places p`;

function mapPlaceView(r: PlaceViewRow): PlaceView {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
    reviewCount: r.review_count,
    avgRating: r.avg_rating ? Math.round(r.avg_rating * 10) / 10 : 0,
  };
}

function mapReview(r: ReviewRow): Review {
  return {
    id: r.id,
    placeId: r.place_id,
    authorId: r.author_id,
    authorName: r.author_name,
    rating: r.rating,
    text: r.text,
    createdAt: r.created_at,
  };
}

interface ItemRow {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  image_url: string;
  location: string;
  seller_id: string;
  seller_name: string;
  created_at: string;
  updated_at: string;
}

function mapItem(r: ItemRow): Item {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    price: r.price,
    category: r.category,
    status: r.status,
    imageUrl: r.image_url,
    location: r.location,
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const DEFAULT_DB_PATH = join(process.cwd(), "data", "community.db");
