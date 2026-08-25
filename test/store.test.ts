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
