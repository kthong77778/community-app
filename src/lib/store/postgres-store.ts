import { createHash, randomBytes, randomUUID } from "crypto";
import { Pool } from "pg";
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

// Postgres-backed Store — the same contract as SqliteStore, for serverless or
// multi-instance deploys where a single SQLite file won't do. Selected in
// ./index.ts when DATABASE_URL is set.
//
// Parity notes vs. SQLite: `?` → `$n` params; `rowid` tie-breaking → a `seq`
// BIGSERIAL column; `COUNT(*)` cast `::int` and `AVG(...)::float` so counts come
// back as JS numbers; `EXISTS(...)` returns a real boolean; timestamps are ISO
// TEXT (they sort lexicographically) exactly like the SQLite store.
export class PostgresStore implements Store {
  private pool: Pool;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.ready = this.migrate();
  }

  private async migrate(): Promise<void> {
    await this.pool.query(`
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

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '자랑',
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC, seq DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);

      CREATE TABLE IF NOT EXISTS likes (
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

      CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        address TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS place_favorites (
        user_id TEXT NOT NULL,
        place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, place_id)
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
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
      CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC, seq DESC);
      CREATE INDEX IF NOT EXISTS idx_items_seller ON items(seller_id);

      CREATE TABLE IF NOT EXISTS item_favorites (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id)
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        image_url TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS product_offers (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        shop TEXT NOT NULL,
        price INTEGER NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_offers_product ON product_offers(product_id, price);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        item_id TEXT,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        buyer_read_at TEXT,
        seller_read_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_conv_buyer ON conversations(buyer_id, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversations(seller_id, last_message_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        seq BIGSERIAL,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    `);

    await this.seedPlacesIfEmpty();
    await this.seedProductsIfEmpty();
  }

  private async seedPlacesIfEmpty(): Promise<void> {
    const { rows } = await this.pool.query(`SELECT COUNT(*)::int AS c FROM places`);
    if (rows[0].c > 0) return;
    const now = new Date().toISOString();
    for (const p of SEED_PLACES) {
      await this.pool.query(
        `INSERT INTO places (id, name, type, address, lat, lng, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), p.name, p.type, p.address, p.lat, p.lng, now],
      );
    }
  }

  private async seedProductsIfEmpty(): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM products`,
    );
    if (rows[0].c > 0) return;
    const now = new Date().toISOString();
    for (const p of SEED_PRODUCTS) {
      const productId = randomUUID();
      await this.pool.query(
        `INSERT INTO products (id, name, brand, category, image_url, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [productId, p.name, p.brand, p.category, p.imageUrl, p.description, now],
      );
      for (const o of p.offers) {
        await this.pool.query(
          `INSERT INTO product_offers (id, product_id, shop, price, url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), productId, o.shop, o.price, o.url, now],
        );
      }
    }
  }

  // Runs fn inside a transaction on a dedicated client.
  private async tx<T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ----- Users -----
  async createUser(data: {
    username: string;
    passwordHash: string;
  }): Promise<User | null> {
    await this.ready;
    const user: User = {
      id: randomUUID(),
      username: data.username,
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString(),
    };
    const res = await this.pool.query(
      `INSERT INTO users (id, username, username_lower, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username_lower) DO NOTHING`,
      [user.id, user.username, user.username.toLowerCase(), user.passwordHash, user.createdAt],
    );
    return res.rowCount === 0 ? null : user; // 0 rows → username taken
  }

  async getUserById(id: string): Promise<User | null> {
    await this.ready;
    const { rows } = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE username_lower = $1`,
      [username.toLowerCase()],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  // ----- Sessions -----
  async createSession(userId: string): Promise<string> {
    await this.ready;
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    await this.pool.query(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [
        hashToken(token),
        userId,
        new Date(now).toISOString(),
        new Date(now + SESSION_TTL_MS).toISOString(),
      ],
    );
    return token;
  }

  async getSessionUser(token: string): Promise<User | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [hashToken(token), new Date().toISOString()],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.ready;
    await this.pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [
      hashToken(token),
    ]);
  }

  // ----- Posts -----
  async createPost(data: {
    title: string;
    content: string;
    category: string;
    authorId: string;
    authorName: string;
  }): Promise<PostView> {
    await this.ready;
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
    await this.pool.query(
      `INSERT INTO posts (id, title, content, category, author_id, author_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [post.id, post.title, post.content, post.category, post.authorId, post.authorName, post.createdAt, post.updatedAt],
    );
    return { ...post, likeCount: 0, commentCount: 0, likedByMe: false };
  }

  async listPostViews(opts: {
    limit: number;
    offset: number;
    currentUserId: string | null;
    category?: string | null;
  }): Promise<PostPage> {
    await this.ready;
    const { limit, offset, currentUserId, category } = opts;
    const params: (string | number)[] = [currentUserId ?? ""];
    let where = "";
    if (category) {
      params.push(category);
      where = `WHERE p.category = $${params.length}`;
    }
    params.push(limit + 1);
    const limIdx = params.length;
    params.push(offset);
    const offIdx = params.length;
    const { rows } = await this.pool.query(
      `${POST_VIEW_SELECT} ${where}
       ORDER BY p.created_at DESC, p.seq DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      params,
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map(mapPostView);
    return { posts: page, hasMore, nextOffset: offset + page.length };
  }

  async listPostsByAuthor(
    authorId: string,
    currentUserId: string | null,
  ): Promise<PostView[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${POST_VIEW_SELECT} WHERE p.author_id = $2 ORDER BY p.created_at DESC, p.seq DESC`,
      [currentUserId ?? "", authorId],
    );
    return rows.map(mapPostView);
  }

  async getPostView(
    id: string,
    currentUserId: string | null,
  ): Promise<PostView | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${POST_VIEW_SELECT} WHERE p.id = $2`,
      [currentUserId ?? "", id],
    );
    return rows[0] ? mapPostView(rows[0]) : null;
  }

  async getPost(id: string): Promise<Post | null> {
    await this.ready;
    const { rows } = await this.pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    return rows[0] ? mapPost(rows[0]) : null;
  }

  async deletePost(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async toggleLike(postId: string, userId: string): Promise<LikeState | null> {
    await this.ready;
    return this.tx(async (c) => {
      const exists = await c.query(`SELECT 1 FROM posts WHERE id = $1`, [postId]);
      if (exists.rowCount === 0) return null;
      const liked = await c.query(
        `SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId],
      );
      if ((liked.rowCount ?? 0) > 0) {
        await c.query(`DELETE FROM likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
      } else {
        await c.query(
          `INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, $3)`,
          [postId, userId, new Date().toISOString()],
        );
      }
      const { rows } = await c.query(
        `SELECT COUNT(*)::int AS c FROM likes WHERE post_id = $1`,
        [postId],
      );
      return { likeCount: rows[0].c, likedByMe: (liked.rowCount ?? 0) === 0 };
    });
  }

  // ----- Comments -----
  async addComment(data: {
    postId: string;
    content: string;
    authorId: string;
    authorName: string;
  }): Promise<Comment> {
    await this.ready;
    const comment: Comment = {
      id: randomUUID(),
      postId: data.postId,
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO comments (id, post_id, content, author_id, author_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [comment.id, comment.postId, comment.content, comment.authorId, comment.authorName, comment.createdAt],
    );
    return comment;
  }

  async listComments(postId: string): Promise<Comment[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC, seq ASC`,
      [postId],
    );
    return rows.map(mapComment);
  }

  async getCommentById(id: string): Promise<Comment | null> {
    await this.ready;
    const { rows } = await this.pool.query(`SELECT * FROM comments WHERE id = $1`, [id]);
    return rows[0] ? mapComment(rows[0]) : null;
  }

  async deleteComment(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.pool.query(`DELETE FROM comments WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ----- Places -----
  async listPlaces(
    type?: string | null,
    currentUserId?: string | null,
  ): Promise<PlaceView[]> {
    await this.ready;
    const params: (string | number)[] = [currentUserId ?? ""];
    let where = "";
    if (type) {
      params.push(type);
      where = `WHERE p.type = $${params.length}`;
    }
    const { rows } = await this.pool.query(
      `${PLACE_VIEW_SELECT} ${where} ORDER BY p.seq ASC`,
      params,
    );
    return rows.map(mapPlaceView);
  }

  async getPlace(
    id: string,
    currentUserId?: string | null,
  ): Promise<PlaceView | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${PLACE_VIEW_SELECT} WHERE p.id = $2`,
      [currentUserId ?? "", id],
    );
    return rows[0] ? mapPlaceView(rows[0]) : null;
  }

  async createPlace(data: {
    name: string;
    type: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<PlaceView> {
    await this.ready;
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO places (id, name, type, address, lat, lng, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.name, data.type, data.address, data.lat, data.lng, new Date().toISOString()],
    );
    return (await this.getPlace(id))!;
  }

  async togglePlaceFavorite(
    userId: string,
    placeId: string,
  ): Promise<PlaceFavoriteState | null> {
    await this.ready;
    return this.tx(async (c) => {
      const exists = await c.query(`SELECT 1 FROM places WHERE id = $1`, [placeId]);
      if (exists.rowCount === 0) return null;
      const fav = await c.query(
        `SELECT 1 FROM place_favorites WHERE user_id = $1 AND place_id = $2`,
        [userId, placeId],
      );
      if ((fav.rowCount ?? 0) > 0) {
        await c.query(`DELETE FROM place_favorites WHERE user_id = $1 AND place_id = $2`, [userId, placeId]);
        return { favorited: false };
      }
      await c.query(
        `INSERT INTO place_favorites (user_id, place_id, created_at) VALUES ($1, $2, $3)`,
        [userId, placeId, new Date().toISOString()],
      );
      return { favorited: true };
    });
  }

  async listFavoritePlaces(userId: string): Promise<PlaceView[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${PLACE_VIEW_SELECT}
       JOIN place_favorites fav ON fav.place_id = p.id AND fav.user_id = $2
       ORDER BY fav.created_at DESC, p.seq DESC`,
      [userId, userId],
    );
    return rows.map(mapPlaceView);
  }

  // ----- Reviews -----
  async addReview(data: {
    placeId: string;
    authorId: string;
    authorName: string;
    rating: number;
    text: string;
  }): Promise<Review> {
    await this.ready;
    const review: Review = {
      id: randomUUID(),
      placeId: data.placeId,
      authorId: data.authorId,
      authorName: data.authorName,
      rating: data.rating,
      text: data.text,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO reviews (id, place_id, author_id, author_name, rating, text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [review.id, review.placeId, review.authorId, review.authorName, review.rating, review.text, review.createdAt],
    );
    return review;
  }

  async listReviews(placeId: string): Promise<Review[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT * FROM reviews WHERE place_id = $1 ORDER BY created_at DESC, seq DESC`,
      [placeId],
    );
    return rows.map(mapReview);
  }

  async getReviewById(id: string): Promise<Review | null> {
    await this.ready;
    const { rows } = await this.pool.query(`SELECT * FROM reviews WHERE id = $1`, [id]);
    return rows[0] ? mapReview(rows[0]) : null;
  }

  async deleteReview(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.pool.query(`DELETE FROM reviews WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ----- Marketplace -----
  async listItems(opts?: {
    category?: string | null;
    status?: string | null;
    currentUserId?: string | null;
  }): Promise<ItemView[]> {
    await this.ready;
    const params: (string | number)[] = [opts?.currentUserId ?? ""];
    const clauses: string[] = [];
    if (opts?.category) {
      params.push(opts.category);
      clauses.push(`i.category = $${params.length}`);
    }
    if (opts?.status) {
      params.push(opts.status);
      clauses.push(`i.status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await this.pool.query(
      `${ITEM_VIEW_SELECT} ${where} ORDER BY i.created_at DESC, i.seq DESC`,
      params,
    );
    return rows.map(mapItemView);
  }

  async getItem(id: string, currentUserId?: string | null): Promise<ItemView | null> {
    await this.ready;
    const { rows } = await this.pool.query(`${ITEM_VIEW_SELECT} WHERE i.id = $2`, [
      currentUserId ?? "",
      id,
    ]);
    return rows[0] ? mapItemView(rows[0]) : null;
  }

  async listItemsBySeller(
    sellerId: string,
    currentUserId?: string | null,
  ): Promise<ItemView[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${ITEM_VIEW_SELECT} WHERE i.seller_id = $2 ORDER BY i.created_at DESC, i.seq DESC`,
      [currentUserId ?? "", sellerId],
    );
    return rows.map(mapItemView);
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
    await this.ready;
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
    await this.pool.query(
      `INSERT INTO items (id, title, description, price, category, status, image_url, location, seller_id, seller_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [item.id, item.title, item.description, item.price, item.category, item.status, item.imageUrl, item.location, item.sellerId, item.sellerName, item.createdAt, item.updatedAt],
    );
    return item;
  }

  async updateItemStatus(id: string, status: string): Promise<Item | null> {
    await this.ready;
    const res = await this.pool.query(
      `UPDATE items SET status = $1, updated_at = $2 WHERE id = $3`,
      [status, new Date().toISOString(), id],
    );
    if (res.rowCount === 0) return null;
    return this.getItem(id);
  }

  async deleteItem(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.pool.query(`DELETE FROM items WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async toggleItemFavorite(
    userId: string,
    itemId: string,
  ): Promise<ItemFavoriteState | null> {
    await this.ready;
    return this.tx(async (c) => {
      const exists = await c.query(`SELECT 1 FROM items WHERE id = $1`, [itemId]);
      if (exists.rowCount === 0) return null;
      const fav = await c.query(
        `SELECT 1 FROM item_favorites WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId],
      );
      if ((fav.rowCount ?? 0) > 0) {
        await c.query(`DELETE FROM item_favorites WHERE user_id = $1 AND item_id = $2`, [userId, itemId]);
        return { favorited: false };
      }
      await c.query(
        `INSERT INTO item_favorites (user_id, item_id, created_at) VALUES ($1, $2, $3)`,
        [userId, itemId, new Date().toISOString()],
      );
      return { favorited: true };
    });
  }

  async listFavoriteItems(userId: string): Promise<ItemView[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${ITEM_VIEW_SELECT}
       JOIN item_favorites fav ON fav.item_id = i.id AND fav.user_id = $2
       ORDER BY fav.created_at DESC, i.seq DESC`,
      [userId, userId],
    );
    return rows.map(mapItemView);
  }

  // ----- Shopping -----
  async listProducts(opts?: {
    category?: string | null;
    sort?: "lowest" | "latest";
  }): Promise<ProductView[]> {
    await this.ready;
    const params: (string | number)[] = [];
    let where = "";
    if (opts?.category) {
      params.push(opts.category);
      where = `WHERE p.category = $${params.length}`;
    }
    const order =
      opts?.sort === "lowest"
        ? `ORDER BY (lowest_price IS NULL) ASC, lowest_price ASC, p.seq DESC`
        : `ORDER BY p.created_at DESC, p.seq DESC`;
    const { rows } = await this.pool.query(
      `${PRODUCT_VIEW_SELECT} ${where} ${order}`,
      params,
    );
    return rows.map(mapProductView);
  }

  async getProduct(id: string): Promise<ProductView | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${PRODUCT_VIEW_SELECT} WHERE p.id = $1`,
      [id],
    );
    return rows[0] ? mapProductView(rows[0]) : null;
  }

  async listOffers(productId: string): Promise<Offer[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT * FROM product_offers WHERE product_id = $1 ORDER BY price ASC, seq ASC`,
      [productId],
    );
    return rows.map(mapOffer);
  }

  async createProduct(data: {
    name: string;
    brand: string;
    category: string;
    imageUrl: string;
    description: string;
  }): Promise<Product> {
    await this.ready;
    const product: Product = {
      id: randomUUID(),
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
      description: data.description,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO products (id, name, brand, category, image_url, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [product.id, product.name, product.brand, product.category, product.imageUrl, product.description, product.createdAt],
    );
    return product;
  }

  async addOffer(data: {
    productId: string;
    shop: string;
    price: number;
    url: string;
  }): Promise<Offer> {
    await this.ready;
    const offer: Offer = {
      id: randomUUID(),
      productId: data.productId,
      shop: data.shop,
      price: data.price,
      url: data.url,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO product_offers (id, product_id, shop, price, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [offer.id, offer.productId, offer.shop, offer.price, offer.url, offer.createdAt],
    );
    return offer;
  }

  // ----- Chat -----
  async getOrCreateConversation(data: {
    itemId: string | null;
    buyerId: string;
    sellerId: string;
  }): Promise<Conversation> {
    await this.ready;
    return this.tx(async (c) => {
      const existing =
        data.itemId === null
          ? await c.query(
              `SELECT * FROM conversations WHERE item_id IS NULL AND buyer_id = $1 AND seller_id = $2`,
              [data.buyerId, data.sellerId],
            )
          : await c.query(
              `SELECT * FROM conversations WHERE item_id = $1 AND buyer_id = $2 AND seller_id = $3`,
              [data.itemId, data.buyerId, data.sellerId],
            );
      if (existing.rows[0]) return mapConversation(existing.rows[0]);

      const now = new Date().toISOString();
      const convo: Conversation = {
        id: randomUUID(),
        itemId: data.itemId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        createdAt: now,
        lastMessageAt: now,
      };
      await c.query(
        `INSERT INTO conversations (id, item_id, buyer_id, seller_id, created_at, last_message_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [convo.id, convo.itemId, convo.buyerId, convo.sellerId, convo.createdAt, convo.lastMessageAt],
      );
      return convo;
    });
  }

  async listConversations(userId: string): Promise<ConversationView[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${CONVO_VIEW_SELECT}
       WHERE c.buyer_id = $3 OR c.seller_id = $4
       ORDER BY c.last_message_at DESC, c.seq DESC`,
      [userId, userId, userId, userId],
    );
    return rows.map((r) => mapConversationView(r, userId));
  }

  async getConversationForUser(
    id: string,
    userId: string,
  ): Promise<ConversationView | null> {
    await this.ready;
    const { rows } = await this.pool.query(
      `${CONVO_VIEW_SELECT}
       WHERE c.id = $3 AND (c.buyer_id = $4 OR c.seller_id = $5)`,
      [userId, userId, id, userId, userId],
    );
    return rows[0] ? mapConversationView(rows[0], userId) : null;
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC, seq ASC`,
      [conversationId],
    );
    return rows.map(mapMessage);
  }

  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    text: string;
  }): Promise<Message> {
    await this.ready;
    const message: Message = {
      id: randomUUID(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      text: data.text,
      createdAt: new Date().toISOString(),
    };
    await this.tx(async (c) => {
      await c.query(
        `INSERT INTO messages (id, conversation_id, sender_id, text, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [message.id, message.conversationId, message.senderId, message.text, message.createdAt],
      );
      await c.query(`UPDATE conversations SET last_message_at = $1 WHERE id = $2`, [
        message.createdAt,
        message.conversationId,
      ]);
    });
    return message;
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await this.ready;
    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE conversations SET buyer_read_at = $1 WHERE id = $2 AND buyer_id = $3`,
      [now, conversationId, userId],
    );
    await this.pool.query(
      `UPDATE conversations SET seller_read_at = $1 WHERE id = $2 AND seller_id = $3`,
      [now, conversationId, userId],
    );
  }

  async getTotalUnread(userId: string): Promise<number> {
    await this.ready;
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM messages m
       JOIN conversations con ON con.id = m.conversation_id
       WHERE (con.buyer_id = $1 OR con.seller_id = $2)
         AND m.sender_id <> $3
         AND m.created_at > COALESCE(
           CASE WHEN con.buyer_id = $4 THEN con.buyer_read_at ELSE con.seller_read_at END, '')`,
      [userId, userId, userId, userId],
    );
    return rows[0].c;
  }
}

// ----- Row shapes + mappers (snake_case rows -> camelCase domain) -----
// node-postgres returns plain objects keyed by column name; COUNT(*) is cast to
// ::int and EXISTS returns a real boolean, so mappers read numbers/booleans.

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapUser(r: any): User {
  return { id: r.id, username: r.username, passwordHash: r.password_hash, createdAt: r.created_at };
}

const POST_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
    EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) AS liked_by_me
  FROM posts p`;

function mapPost(r: any): Post {
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

function mapPostView(r: any): PostView {
  return {
    ...mapPost(r),
    likeCount: r.like_count,
    commentCount: r.comment_count,
    likedByMe: r.liked_by_me === true,
  };
}

function mapComment(r: any): Comment {
  return {
    id: r.id,
    postId: r.post_id,
    content: r.content,
    authorId: r.author_id,
    authorName: r.author_name,
    createdAt: r.created_at,
  };
}

const PLACE_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*)::int FROM reviews r WHERE r.place_id = p.id) AS review_count,
    (SELECT AVG(r.rating)::float FROM reviews r WHERE r.place_id = p.id) AS avg_rating,
    (SELECT COUNT(*)::int FROM place_favorites f WHERE f.place_id = p.id) AS favorite_count,
    EXISTS(SELECT 1 FROM place_favorites f2 WHERE f2.place_id = p.id AND f2.user_id = $1) AS favorited_by_me
  FROM places p`;

function mapPlaceView(r: any): PlaceView {
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
    favoritedByMe: r.favorited_by_me === true,
  };
}

function mapReview(r: any): Review {
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

const ITEM_VIEW_SELECT = `
  SELECT i.*,
    (SELECT COUNT(*)::int FROM item_favorites f WHERE f.item_id = i.id) AS favorite_count,
    EXISTS(SELECT 1 FROM item_favorites f2 WHERE f2.item_id = i.id AND f2.user_id = $1) AS favorited_by_me
  FROM items i`;

function mapItem(r: any): Item {
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

function mapItemView(r: any): ItemView {
  return {
    ...mapItem(r),
    favoriteCount: r.favorite_count,
    favoritedByMe: r.favorited_by_me === true,
  };
}

const PRODUCT_VIEW_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*)::int FROM product_offers o WHERE o.product_id = p.id) AS offer_count,
    (SELECT MIN(o.price) FROM product_offers o WHERE o.product_id = p.id) AS lowest_price,
    (SELECT MAX(o.price) FROM product_offers o WHERE o.product_id = p.id) AS highest_price
  FROM products p`;

function mapProduct(r: any): Product {
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

function mapProductView(r: any): ProductView {
  return {
    ...mapProduct(r),
    offerCount: r.offer_count,
    lowestPrice: r.lowest_price ?? 0,
    highestPrice: r.highest_price ?? 0,
  };
}

function mapOffer(r: any): Offer {
  return {
    id: r.id,
    productId: r.product_id,
    shop: r.shop,
    price: r.price,
    url: r.url,
    createdAt: r.created_at,
  };
}

const CONVO_VIEW_SELECT = `
  SELECT c.*,
    i.title AS item_title,
    i.image_url AS item_image_url,
    i.price AS item_price,
    i.status AS item_status,
    (SELECT m.text FROM messages m WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC, m.seq DESC LIMIT 1) AS last_message_text,
    (SELECT COUNT(*)::int FROM messages m2 WHERE m2.conversation_id = c.id
       AND m2.sender_id <> $1
       AND m2.created_at > COALESCE(
         CASE WHEN c.buyer_id = $2 THEN c.buyer_read_at ELSE c.seller_read_at END, ''))
      AS unread_count
  FROM conversations c
  LEFT JOIN items i ON i.id = c.item_id`;

function mapConversation(r: any): Conversation {
  return {
    id: r.id,
    itemId: r.item_id,
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
  };
}

function mapConversationView(r: any, viewerId: string): ConversationView {
  return {
    ...mapConversation(r),
    otherUserId: r.buyer_id === viewerId ? r.seller_id : r.buyer_id,
    itemTitle: r.item_title,
    itemImageUrl: r.item_image_url,
    itemPrice: r.item_price,
    itemStatus: r.item_status,
    lastMessageText: r.last_message_text,
    unreadCount: r.unread_count,
  };
}

function mapMessage(r: any): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    text: r.text,
    createdAt: r.created_at,
  };
}
