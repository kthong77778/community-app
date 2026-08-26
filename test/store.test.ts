import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SqliteStore } from "../src/lib/store/sqlite-store";

// Each test gets a fresh in-memory database.
let store: SqliteStore;
beforeEach(() => {
  store = new SqliteStore(":memory:");
});

async function makeUser(username = "alice") {
  const u = await store.createUser({ username, passwordHash: "hash" });
  assert.ok(u, "user should be created");
  return u!;
}

describe("users", () => {
  it("creates a user", async () => {
    const u = await makeUser();
    assert.equal(u.username, "alice");
    assert.match(u.id, /[0-9a-f-]{36}/);
  });

  it("rejects a duplicate username atomically (case-insensitive)", async () => {
    await makeUser("Alice");
    const dup = await store.createUser({ username: "alice", passwordHash: "h" });
    assert.equal(dup, null, "duplicate should return null");
  });

  it("looks up by username case-insensitively", async () => {
    const u = await makeUser("Bob");
    const found = await store.getUserByUsername("bob");
    assert.equal(found?.id, u.id);
  });
});

describe("sessions", () => {
  it("creates and resolves a session", async () => {
    const u = await makeUser();
    const token = await store.createSession(u.id);
    const resolved = await store.getSessionUser(token);
    assert.equal(resolved?.id, u.id);
  });

  it("revokes a session on delete (logout)", async () => {
    const u = await makeUser();
    const token = await store.createSession(u.id);
    await store.deleteSession(token);
    assert.equal(await store.getSessionUser(token), null);
  });

  it("returns null for an unknown token", async () => {
    assert.equal(await store.getSessionUser("nope"), null);
  });
});

describe("posts + likes", () => {
  it("creates a post with zero counts", async () => {
    const u = await makeUser();
    const post = await store.createPost({
      title: "t",
      content: "c",
      category: "자랑",
      authorId: u.id,
      authorName: u.username,
    });
    assert.equal(post.likeCount, 0);
    assert.equal(post.commentCount, 0);
    assert.equal(post.likedByMe, false);
  });

  it("toggles likes and reports likedByMe per user", async () => {
    const author = await makeUser("author");
    const other = await makeUser("other");
    const post = await store.createPost({
      title: "t",
      content: "c",
      category: "자랑",
      authorId: author.id,
      authorName: author.username,
    });

    let s = await store.toggleLike(post.id, other.id);
    assert.deepEqual(s, { likeCount: 1, likedByMe: true });

    // Author's view sees the like count but not likedByMe.
    const viewAuthor = await store.getPostView(post.id, author.id);
    assert.equal(viewAuthor?.likeCount, 1);
    assert.equal(viewAuthor?.likedByMe, false);

    // Toggling again removes it.
    s = await store.toggleLike(post.id, other.id);
    assert.deepEqual(s, { likeCount: 0, likedByMe: false });
  });

  it("returns null when liking a missing post", async () => {
    const u = await makeUser();
    assert.equal(await store.toggleLike("missing", u.id), null);
  });

  it("paginates newest-first with hasMore", async () => {
    const u = await makeUser();
    for (let i = 0; i < 5; i++) {
      await store.createPost({
        title: `p${i}`,
        content: "c",
        category: "자랑",
        authorId: u.id,
        authorName: u.username,
      });
    }
    const page1 = await store.listPostViews({ limit: 2, offset: 0, currentUserId: null });
    assert.equal(page1.posts.length, 2);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.nextOffset, 2);

    const last = await store.listPostViews({ limit: 2, offset: 4, currentUserId: null });
    assert.equal(last.posts.length, 1);
    assert.equal(last.hasMore, false);
  });

  it("cascades comment/like deletion when a post is deleted", async () => {
    const u = await makeUser();
    const post = await store.createPost({
      title: "t",
      content: "c",
      category: "자랑",
      authorId: u.id,
      authorName: u.username,
    });
    await store.toggleLike(post.id, u.id);
    await store.addComment({
      postId: post.id,
      content: "x",
      authorId: u.id,
      authorName: u.username,
    });
    assert.equal(await store.deletePost(post.id), true);
    assert.equal((await store.listComments(post.id)).length, 0);
    assert.equal(await store.getPostView(post.id, u.id), null);
  });
});

describe("categories", () => {
  it("stores the category and filters by it", async () => {
    const u = await makeUser();
    for (const cat of ["자랑", "질문", "자랑", "홍보"]) {
      await store.createPost({
        title: cat,
        content: "c",
        category: cat,
        authorId: u.id,
        authorName: u.username,
      });
    }
    const all = await store.listPostViews({ limit: 20, offset: 0, currentUserId: null });
    assert.equal(all.posts.length, 4);

    const brag = await store.listPostViews({
      limit: 20,
      offset: 0,
      currentUserId: null,
      category: "자랑",
    });
    assert.equal(brag.posts.length, 2);
    assert.ok(brag.posts.every((p) => p.category === "자랑"));

    const promo = await store.listPostViews({
      limit: 20,
      offset: 0,
      currentUserId: null,
      category: "홍보",
    });
    assert.equal(promo.posts.length, 1);
  });
});

describe("places + reviews", () => {
  it("seeds default places and filters by type", async () => {
    const all = await store.listPlaces();
    assert.ok(all.length >= 6, "default places should be seeded");
    const hospitals = await store.listPlaces("병원");
    assert.ok(hospitals.length >= 1);
    assert.ok(hospitals.every((p) => p.type === "병원"));
  });

  it("starts places with no reviews", async () => {
    const [place] = await store.listPlaces();
    assert.equal(place.reviewCount, 0);
    assert.equal(place.avgRating, 0);
  });

  it("adds reviews and computes the average rating", async () => {
    const u = await makeUser();
    const [place] = await store.listPlaces();
    await store.addReview({ placeId: place.id, authorId: u.id, authorName: u.username, rating: 5, text: "최고예요" });
    await store.addReview({ placeId: place.id, authorId: u.id, authorName: u.username, rating: 4, text: "좋아요" });

    const view = await store.getPlace(place.id);
    assert.equal(view?.reviewCount, 2);
    assert.equal(view?.avgRating, 4.5);

    const reviews = await store.listReviews(place.id);
    assert.equal(reviews.length, 2);
    assert.equal(reviews[0].text, "좋아요"); // newest first
  });

  it("cascades review deletion — reviews reference a place", async () => {
    const u = await makeUser();
    const place = await store.createPlace({ name: "테스트샵", type: "샵", address: "어딘가", lat: 37.5, lng: 127 });
    const r = await store.addReview({ placeId: place.id, authorId: u.id, authorName: u.username, rating: 3, text: "보통" });
    assert.ok(await store.getReviewById(r.id));
    assert.equal(await store.deleteReview(r.id), true);
    assert.equal(await store.getReviewById(r.id), null);
  });
});

describe("marketplace items", () => {
  async function makeItem(over: Partial<Parameters<typeof store.createItem>[0]> = {}) {
    return store.createItem({
      title: "강아지 자동급식기",
      description: "거의 새것",
      price: 25000,
      category: "기타",
      imageUrl: "",
      location: "서울 마포구",
      sellerId: "seller1",
      sellerName: "seller1",
      ...over,
    });
  }

  it("creates a listing defaulting to 판매중", async () => {
    const item = await makeItem();
    assert.equal(item.status, "판매중");
    assert.equal(item.price, 25000);
  });

  it("lists newest-first and filters by category and status", async () => {
    await makeItem({ title: "A", category: "장난감" });
    await makeItem({ title: "B", category: "의류" });
    const c = await makeItem({ title: "C", category: "장난감" });

    const all = await store.listItems();
    assert.equal(all.length, 3);
    assert.equal(all[0].id, c.id); // newest first

    const toys = await store.listItems({ category: "장난감" });
    assert.equal(toys.length, 2);
    assert.ok(toys.every((i) => i.category === "장난감"));

    await store.updateItemStatus(c.id, "판매완료");
    const onSale = await store.listItems({ status: "판매중" });
    assert.equal(onSale.length, 2);
  });

  it("updates status and deletes", async () => {
    const item = await makeItem();
    const updated = await store.updateItemStatus(item.id, "예약중");
    assert.equal(updated?.status, "예약중");
    assert.equal(await store.deleteItem(item.id), true);
    assert.equal(await store.getItem(item.id), null);
  });
});

describe("comments", () => {
  it("adds, lists, and counts comments", async () => {
    const u = await makeUser();
    const post = await store.createPost({
      title: "t",
      content: "c",
      category: "자랑",
      authorId: u.id,
      authorName: u.username,
    });
    await store.addComment({ postId: post.id, content: "one", authorId: u.id, authorName: u.username });
    await store.addComment({ postId: post.id, content: "two", authorId: u.id, authorName: u.username });

    const comments = await store.listComments(post.id);
    assert.equal(comments.length, 2);
    assert.equal(comments[0].content, "one"); // oldest first

    const view = await store.getPostView(post.id, u.id);
    assert.equal(view?.commentCount, 2);
  });

  it("deletes a comment by id", async () => {
    const u = await makeUser();
    const post = await store.createPost({
      title: "t",
      content: "c",
      category: "자랑",
      authorId: u.id,
      authorName: u.username,
    });
    const c = await store.addComment({
      postId: post.id,
      content: "x",
      authorId: u.id,
      authorName: u.username,
    });
    assert.ok(await store.getCommentById(c.id));
    assert.equal(await store.deleteComment(c.id), true);
    assert.equal(await store.getCommentById(c.id), null);
  });
});
