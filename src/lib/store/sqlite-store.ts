import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import type { Store } from "./Store";
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
import { SEED_PLACES } from "./seed-places";
import { SEED_PRODUCTS } from "./seed-products";

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

      CREATE TABLE IF NOT EXISTS place_favorites (
        user_id TEXT NOT NULL,
        place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, place_id)
      );
      CREATE INDEX IF NOT EXISTS idx_place_favorites_user ON place_favorites(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_place_favorites_place ON place_favorites(place_id);

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

      CREATE TABLE IF NOT EXISTS item_favorites (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_item_favorites_user ON item_favorites(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_item_favorites_item ON item_favorites(item_id);

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        image_url TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

      CREATE TABLE IF NOT EXISTS product_offers (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        shop TEXT NOT NULL,
        price INTEGER NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offers_product ON product_offers(product_id, price);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        item_id TEXT,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conv_buyer ON conversations(buyer_id, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversations(seller_id, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conv_lookup ON conversations(item_id, buyer_id, seller_id);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    `);

    // Additive column migrations for databases created before a column existed.
    this.addColumnIfMissing("posts", "category", "TEXT NOT NULL DEFAULT '자랑'");

    this.seedPlacesIfEmpty();
    this.seedProductsIfEmpty();
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

  private seedProductsIfEmpty(): void {
    const { c } = this.db
      .prepare(`SELECT COUNT(*) AS c FROM products`)
      .get() as { c: number };
    if (c > 0) return;
    const now = new Date().toISOString();
    const insertProduct = this.db.prepare(
      `INSERT INTO products (id, name, brand, category, image_url, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertOffer = this.db.prepare(
      `INSERT INTO product_offers (id, product_id, shop, price, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const seed = this.db.transaction(() => {
      for (const p of SEED_PRODUCTS) {
        const productId = randomUUID();
        insertProduct.run(
          productId,
          p.name,
          p.brand,
          p.category,
          p.imageUrl,
          p.description,
          now,
        );
        for (const o of p.offers) {
          insertOffer.run(randomUUID(), productId, o.shop, o.price, o.url, now);
        }
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
  async listPlaces(
    type?: string | null,
    currentUserId?: string | null,
  ): Promise<PlaceView[]> {
    const where = type ? `WHERE p.type = ?` : ``;
    // The favorited_by_me subquery param comes first (see PLACE_VIEW_SELECT).
    const params: (string | number)[] = [currentUserId ?? ""];
    if (type) params.push(type);
    const rows = this.db
      .prepare(`${PLACE_VIEW_SELECT} ${where} ORDER BY p.rowid ASC`)
      .all(...params) as PlaceViewRow[];
    return rows.map(mapPlaceView);
  }

  async getPlace(
    id: string,
    currentUserId?: string | null,
  ): Promise<PlaceView | null> {
    const row = this.db
      .prepare(`${PLACE_VIEW_SELECT} WHERE p.id = ?`)
      .get(currentUserId ?? "", id) as PlaceViewRow | undefined;
    return row ? mapPlaceView(row) : null;
  }

  async togglePlaceFavorite(
    userId: string,
    placeId: string,
  ): Promise<PlaceFavoriteState | null> {
    const toggle = this.db.transaction((): PlaceFavoriteState | null => {
      const exists = this.db
        .prepare(`SELECT 1 FROM places WHERE id = ?`)
        .get(placeId);
      if (!exists) return null;

      const favorited = this.db
        .prepare(
          `SELECT 1 FROM place_favorites WHERE user_id = ? AND place_id = ?`,
        )
        .get(userId, placeId);

      if (favorited) {
        this.db
          .prepare(
            `DELETE FROM place_favorites WHERE user_id = ? AND place_id = ?`,
          )
          .run(userId, placeId);
        return { favorited: false };
      }
      this.db
        .prepare(
          `INSERT INTO place_favorites (user_id, place_id, created_at) VALUES (?, ?, ?)`,
        )
        .run(userId, placeId, new Date().toISOString());
      return { favorited: true };
    });
    return toggle();
  }

  async listFavoritePlaces(userId: string): Promise<PlaceView[]> {
    // Join against the favorites the user owns and order by when they were
    // favorited (newest first). rowid breaks same-millisecond ties.
    const rows = this.db
      .prepare(
        `${PLACE_VIEW_SELECT}
         JOIN place_favorites fav ON fav.place_id = p.id AND fav.user_id = ?
         ORDER BY fav.created_at DESC, p.rowid DESC`,
      )
      .all(userId, userId) as PlaceViewRow[];
    return rows.map(mapPlaceView);
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
    currentUserId?: string | null;
  }): Promise<ItemView[]> {
    const clauses: string[] = [];
    // The favorited_by_me subquery param comes first (see ITEM_VIEW_SELECT).
    const params: (string | number)[] = [opts?.currentUserId ?? ""];
    if (opts?.category) {
      clauses.push("i.category = ?");
      params.push(opts.category);
    }
    if (opts?.status) {
      clauses.push("i.status = ?");
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `${ITEM_VIEW_SELECT} ${where} ORDER BY i.created_at DESC, i.rowid DESC`,
      )
      .all(...params) as ItemViewRow[];
    return rows.map(mapItemView);
  }

  async getItem(
    id: string,
    currentUserId?: string | null,
  ): Promise<ItemView | null> {
    const row = this.db
      .prepare(`${ITEM_VIEW_SELECT} WHERE i.id = ?`)
      .get(currentUserId ?? "", id) as ItemViewRow | undefined;
    return row ? mapItemView(row) : null;
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

  async toggleItemFavorite(
    userId: string,
    itemId: string,
  ): Promise<ItemFavoriteState | null> {
    const toggle = this.db.transaction((): ItemFavoriteState | null => {
      const exists = this.db
        .prepare(`SELECT 1 FROM items WHERE id = ?`)
        .get(itemId);
      if (!exists) return null;

      const favorited = this.db
        .prepare(
          `SELECT 1 FROM item_favorites WHERE user_id = ? AND item_id = ?`,
        )
        .get(userId, itemId);

      if (favorited) {
        this.db
          .prepare(
            `DELETE FROM item_favorites WHERE user_id = ? AND item_id = ?`,
          )
          .run(userId, itemId);
        return { favorited: false };
      }
      this.db
        .prepare(
          `INSERT INTO item_favorites (user_id, item_id, created_at) VALUES (?, ?, ?)`,
        )
        .run(userId, itemId, new Date().toISOString());
      return { favorited: true };
    });
    return toggle();
  }

  async listFavoriteItems(userId: string): Promise<ItemView[]> {
    // Join against the favorites the user owns and order by when they were
    // favorited (newest first). rowid breaks same-millisecond ties.
    const rows = this.db
      .prepare(
        `${ITEM_VIEW_SELECT}
         JOIN item_favorites fav ON fav.item_id = i.id AND fav.user_id = ?
         ORDER BY fav.created_at DESC, i.rowid DESC`,
      )
      .all(userId, userId) as ItemViewRow[];
    return rows.map(mapItemView);
  }

  // ----- Shopping (쇼핑/물품 비교) -----
  async listProducts(opts?: {
    category?: string | null;
    sort?: "lowest" | "latest";
  }): Promise<ProductView[]> {
    const params: (string | number)[] = [];
    let where = "";
    if (opts?.category) {
      where = "WHERE p.category = ?";
      params.push(opts.category);
    }
    // lowest: cheapest first, products with no offers (NULL) sorted last.
    const order =
      opts?.sort === "lowest"
        ? `ORDER BY (lowest_price IS NULL), lowest_price ASC, p.rowid DESC`
        : `ORDER BY p.created_at DESC, p.rowid DESC`;
    const rows = this.db
      .prepare(`${PRODUCT_VIEW_SELECT} ${where} ${order}`)
      .all(...params) as ProductViewRow[];
    return rows.map(mapProductView);
  }

  async getProduct(id: string): Promise<ProductView | null> {
    const row = this.db
      .prepare(`${PRODUCT_VIEW_SELECT} WHERE p.id = ?`)
      .get(id) as ProductViewRow | undefined;
    return row ? mapProductView(row) : null;
  }

  async listOffers(productId: string): Promise<Offer[]> {
    // Cheapest first; rowid breaks same-price ties deterministically.
    const rows = this.db
      .prepare(
        `SELECT * FROM product_offers WHERE product_id = ? ORDER BY price ASC, rowid ASC`,
      )
      .all(productId) as OfferRow[];
    return rows.map(mapOffer);
  }

  async createProduct(data: {
    name: string;
    brand: string;
    category: string;
    imageUrl: string;
    description: string;
  }): Promise<Product> {
    const product: Product = {
      id: randomUUID(),
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
      description: data.description,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO products (id, name, brand, category, image_url, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        product.id,
        product.name,
        product.brand,
        product.category,
        product.imageUrl,
        product.description,
        product.createdAt,
      );
    return product;
  }

  async addOffer(data: {
    productId: string;
    shop: string;
    price: number;
    url: string;
  }): Promise<Offer> {
    const offer: Offer = {
      id: randomUUID(),
      productId: data.productId,
      shop: data.shop,
      price: data.price,
      url: data.url,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO product_offers (id, product_id, shop, price, url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        offer.id,
        offer.productId,
        offer.shop,
        offer.price,
        offer.url,
        offer.createdAt,
      );
    return offer;
  }

  // ----- Chat (1:1 메시지) -----
  async getOrCreateConversation(data: {
    itemId: string | null;
    buyerId: string;
    sellerId: string;
  }): Promise<Conversation> {
    const run = this.db.transaction((): Conversation => {
      const existing = (
        data.itemId === null
          ? this.db
              .prepare(
                `SELECT * FROM conversations
                 WHERE item_id IS NULL AND buyer_id = ? AND seller_id = ?`,
              )
              .get(data.buyerId, data.sellerId)
          : this.db
              .prepare(
                `SELECT * FROM conversations
                 WHERE item_id = ? AND buyer_id = ? AND seller_id = ?`,
              )
              .get(data.itemId, data.buyerId, data.sellerId)
      ) as ConversationRow | undefined;
      if (existing) return mapConversation(existing);

      const now = new Date().toISOString();
      const convo: Conversation = {
        id: randomUUID(),
        itemId: data.itemId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        createdAt: now,
        lastMessageAt: now,
      };
      this.db
        .prepare(
          `INSERT INTO conversations (id, item_id, buyer_id, seller_id, created_at, last_message_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          convo.id,
          convo.itemId,
          convo.buyerId,
          convo.sellerId,
          convo.createdAt,
          convo.lastMessageAt,
        );
      return convo;
    });
    return run();
  }

  async listConversations(userId: string): Promise<ConversationView[]> {
    const rows = this.db
      .prepare(
        `${CONVO_VIEW_SELECT}
         WHERE c.buyer_id = ? OR c.seller_id = ?
         ORDER BY c.last_message_at DESC, c.rowid DESC`,
      )
      .all(userId, userId) as ConversationViewRow[];
    return rows.map((r) => mapConversationView(r, userId));
  }

  async getConversationForUser(
    id: string,
    userId: string,
  ): Promise<ConversationView | null> {
    const row = this.db
      .prepare(
        `${CONVO_VIEW_SELECT}
         WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)`,
      )
      .get(id, userId, userId) as ConversationViewRow | undefined;
    return row ? mapConversationView(row, userId) : null;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`,
      )
      .all(conversationId) as MessageRow[];
    return rows.map(mapMessage);
  }

  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    text: string;
  }): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      text: data.text,
      createdAt: new Date().toISOString(),
    };
    const run = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO messages (id, conversation_id, sender_id, text, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          message.id,
          message.conversationId,
          message.senderId,
          message.text,
          message.createdAt,
        );
      this.db
        .prepare(`UPDATE conversations SET last_message_at = ? WHERE id = ?`)
        .run(message.createdAt, message.conversationId);
    });
    run();
    return message;
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
  favorite_count: number;
  favorited_by_me: number;
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

// Place select enriched with review + favorite aggregates. The first `?` binds
// the current viewer id for favorited_by_me; add WHERE/JOIN clauses after it.
const PLACE_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM reviews r WHERE r.place_id = p.id) AS review_count,
    (SELECT AVG(r.rating) FROM reviews r WHERE r.place_id = p.id) AS avg_rating,
    (SELECT COUNT(*) FROM place_favorites f WHERE f.place_id = p.id) AS favorite_count,
    EXISTS(SELECT 1 FROM place_favorites f2 WHERE f2.place_id = p.id AND f2.user_id = ?) AS favorited_by_me
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
    favoriteCount: r.favorite_count,
    favoritedByMe: r.favorited_by_me === 1,
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

interface ItemViewRow extends ItemRow {
  favorite_count: number;
  favorited_by_me: number;
}

// Item select enriched with favorite aggregates. The first `?` binds the
// current viewer id for favorited_by_me; add WHERE/JOIN clauses after it.
const ITEM_VIEW_SELECT = `
  SELECT i.*,
    (SELECT COUNT(*) FROM item_favorites f WHERE f.item_id = i.id) AS favorite_count,
    EXISTS(SELECT 1 FROM item_favorites f2 WHERE f2.item_id = i.id AND f2.user_id = ?) AS favorited_by_me
  FROM items i`;

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

function mapItemView(r: ItemViewRow): ItemView {
  return {
    ...mapItem(r),
    favoriteCount: r.favorite_count,
    favoritedByMe: r.favorited_by_me === 1,
  };
}

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  image_url: string;
  description: string;
  created_at: string;
}

interface ProductViewRow extends ProductRow {
  offer_count: number;
  lowest_price: number | null;
  highest_price: number | null;
}

interface OfferRow {
  id: string;
  product_id: string;
  shop: string;
  price: number;
  url: string;
  created_at: string;
}

const PRODUCT_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM product_offers o WHERE o.product_id = p.id) AS offer_count,
    (SELECT MIN(o.price) FROM product_offers o WHERE o.product_id = p.id) AS lowest_price,
    (SELECT MAX(o.price) FROM product_offers o WHERE o.product_id = p.id) AS highest_price
  FROM products p`;

function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    imageUrl: r.image_url,
    description: r.description,
    createdAt: r.created_at,
  };
}

function mapProductView(r: ProductViewRow): ProductView {
  return {
    ...mapProduct(r),
    offerCount: r.offer_count,
    lowestPrice: r.lowest_price ?? 0,
    highestPrice: r.highest_price ?? 0,
  };
}

function mapOffer(r: OfferRow): Offer {
  return {
    id: r.id,
    productId: r.product_id,
    shop: r.shop,
    price: r.price,
    url: r.url,
    createdAt: r.created_at,
  };
}

interface ConversationRow {
  id: string;
  item_id: string | null;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  last_message_at: string;
}

interface ConversationViewRow extends ConversationRow {
  item_title: string | null;
  item_image_url: string | null;
  item_price: number | null;
  item_status: string | null;
  last_message_text: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

const CONVO_VIEW_SELECT = `
  SELECT c.*,
    i.title AS item_title,
    i.image_url AS item_image_url,
    i.price AS item_price,
    i.status AS item_status,
    (SELECT m.text FROM messages m WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message_text
  FROM conversations c
  LEFT JOIN items i ON i.id = c.item_id`;

function mapConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    itemId: r.item_id,
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
  };
}

function mapConversationView(
  r: ConversationViewRow,
  viewerId: string,
): ConversationView {
  return {
    ...mapConversation(r),
    otherUserId: r.buyer_id === viewerId ? r.seller_id : r.buyer_id,
    itemTitle: r.item_title,
    itemImageUrl: r.item_image_url,
    itemPrice: r.item_price,
    itemStatus: r.item_status,
    lastMessageText: r.last_message_text,
  };
}

function mapMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    text: r.text,
    createdAt: r.created_at,
  };
}

export const DEFAULT_DB_PATH = join(process.cwd(), "data", "community.db");
