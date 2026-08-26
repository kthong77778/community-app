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

  it("reports place favorite aggregates per viewer", async () => {
    const fan = await makeUser("fan");
    const [place] = await store.listPlaces();

    // No favorites yet, and no viewer context.
    const fresh = await store.getPlace(place.id);
    assert.equal(fresh?.favoriteCount, 0);
    assert.equal(fresh?.favoritedByMe, false);

    const state = await store.togglePlaceFavorite(fan.id, place.id);
    assert.deepEqual(state, { favorited: true });

    // The fan sees favoritedByMe; another viewer sees the count only.
    const asFan = await store.getPlace(place.id, fan.id);
    assert.equal(asFan?.favoriteCount, 1);
    assert.equal(asFan?.favoritedByMe, true);

    const asOther = await store.getPlace(place.id, "someone-else");
    assert.equal(asOther?.favoriteCount, 1);
    assert.equal(asOther?.favoritedByMe, false);

    // listPlaces carries the viewer's favorite flag too.
    const listed = await store.listPlaces(null, fan.id);
    const seen = listed.find((p) => p.id === place.id);
    assert.equal(seen?.favoritedByMe, true);
    assert.equal(seen?.favoriteCount, 1);
  });

  it("toggles a place favorite off and prevents duplicates", async () => {
    const fan = await makeUser("fan");
    const [place] = await store.listPlaces();

    const on = await store.togglePlaceFavorite(fan.id, place.id);
    assert.deepEqual(on, { favorited: true });
    const off = await store.togglePlaceFavorite(fan.id, place.id);
    assert.deepEqual(off, { favorited: false });

    const view = await store.getPlace(place.id, fan.id);
    assert.equal(view?.favoriteCount, 0);
    assert.equal(view?.favoritedByMe, false);
  });

  it("returns null when favoriting a missing place", async () => {
    const fan = await makeUser("fan");
    assert.equal(await store.togglePlaceFavorite(fan.id, "missing"), null);
  });

  it("lists favorite places most-recently-favorited first", async () => {
    const fan = await makeUser("fan");
    const places = await store.listPlaces();
    const [a, b] = places;

    await store.togglePlaceFavorite(fan.id, a.id);
    await store.togglePlaceFavorite(fan.id, b.id);

    const favs = await store.listFavoritePlaces(fan.id);
    assert.equal(favs.length, 2);
    assert.equal(favs[0].id, b.id); // newest favorite first
    assert.ok(favs.every((p) => p.favoritedByMe === true));

    // Another user's favorites are independent.
    const other = await makeUser("other");
    assert.equal((await store.listFavoritePlaces(other.id)).length, 0);
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

  it("reports favorite aggregates per viewer", async () => {
    const buyer = await makeUser("buyer");
    const item = await makeItem();

    // No favorites yet, and no viewer context.
    const fresh = await store.getItem(item.id);
    assert.equal(fresh?.favoriteCount, 0);
    assert.equal(fresh?.favoritedByMe, false);

    const state = await store.toggleItemFavorite(buyer.id, item.id);
    assert.deepEqual(state, { favorited: true });

    // The buyer sees favoritedByMe; another viewer sees the count only.
    const asBuyer = await store.getItem(item.id, buyer.id);
    assert.equal(asBuyer?.favoriteCount, 1);
    assert.equal(asBuyer?.favoritedByMe, true);

    const asOther = await store.getItem(item.id, "someone-else");
    assert.equal(asOther?.favoriteCount, 1);
    assert.equal(asOther?.favoritedByMe, false);

    // listItems carries the viewer's favorite flag too.
    const listed = await store.listItems({ currentUserId: buyer.id });
    assert.equal(listed[0].favoritedByMe, true);
    assert.equal(listed[0].favoriteCount, 1);
  });

  it("toggles a favorite off and prevents duplicates", async () => {
    const buyer = await makeUser("buyer");
    const item = await makeItem();

    const on = await store.toggleItemFavorite(buyer.id, item.id);
    assert.deepEqual(on, { favorited: true });
    // Toggling again removes it (no duplicate row inserted).
    const off = await store.toggleItemFavorite(buyer.id, item.id);
    assert.deepEqual(off, { favorited: false });

    const view = await store.getItem(item.id, buyer.id);
    assert.equal(view?.favoriteCount, 0);
    assert.equal(view?.favoritedByMe, false);
  });

  it("returns null when favoriting a missing item", async () => {
    const buyer = await makeUser("buyer");
    assert.equal(await store.toggleItemFavorite(buyer.id, "missing"), null);
  });

  it("lists favorite items most-recently-favorited first", async () => {
    const buyer = await makeUser("buyer");
    const a = await makeItem({ title: "A" });
    const b = await makeItem({ title: "B" });
    await makeItem({ title: "C" }); // never favorited

    await store.toggleItemFavorite(buyer.id, a.id);
    await store.toggleItemFavorite(buyer.id, b.id);

    const favs = await store.listFavoriteItems(buyer.id);
    assert.equal(favs.length, 2);
    assert.equal(favs[0].id, b.id); // newest favorite first
    assert.ok(favs.every((i) => i.favoritedByMe === true));

    // Another user's favorites are independent.
    const other = await makeUser("other");
    assert.equal((await store.listFavoriteItems(other.id)).length, 0);
  });

  it("cascades favorite deletion when an item is deleted", async () => {
    const buyer = await makeUser("buyer");
    const item = await makeItem();
    await store.toggleItemFavorite(buyer.id, item.id);
    assert.equal((await store.listFavoriteItems(buyer.id)).length, 1);

    assert.equal(await store.deleteItem(item.id), true);
    assert.equal((await store.listFavoriteItems(buyer.id)).length, 0);
  });
});

describe("shopping (products + offers)", () => {
  it("seeds a default catalog with offers and price aggregates", async () => {
    const products = await store.listProducts();
    assert.ok(products.length >= 6, "default products should be seeded");
    const withOffers = products.find((p) => p.offerCount > 0);
    assert.ok(withOffers, "seeded products should have offers");
    // lowest/highest reflect the offer spread.
    assert.ok(withOffers!.lowestPrice > 0);
    assert.ok(withOffers!.highestPrice >= withOffers!.lowestPrice);
  });

  it("filters products by category", async () => {
    const feed = await store.listProducts({ category: "사료" });
    assert.ok(feed.length >= 1);
    assert.ok(feed.every((p) => p.category === "사료"));
  });

  it("sorts by lowest price, products without offers last", async () => {
    const noOffer = await store.createProduct({
      name: "무가격 상품",
      brand: "브랜드",
      category: "용품",
      imageUrl: "",
      description: "판매처 없음",
    });

    const byLowest = await store.listProducts({ sort: "lowest" });
    // Every priced product comes before the offer-less one.
    const idx = byLowest.findIndex((p) => p.id === noOffer.id);
    assert.equal(idx, byLowest.length - 1, "offer-less product sorts last");
    // Priced products are in non-decreasing lowestPrice order.
    const priced = byLowest.filter((p) => p.offerCount > 0);
    for (let i = 1; i < priced.length; i++) {
      assert.ok(priced[i].lowestPrice >= priced[i - 1].lowestPrice);
    }
  });

  it("returns a product with offers cheapest first", async () => {
    const product = await store.createProduct({
      name: "테스트 사료",
      brand: "테스트",
      category: "사료",
      imageUrl: "",
      description: "설명",
    });
    await store.addOffer({ productId: product.id, shop: "B샵", price: 20000, url: "https://b" });
    await store.addOffer({ productId: product.id, shop: "A샵", price: 15000, url: "https://a" });
    await store.addOffer({ productId: product.id, shop: "C샵", price: 18000, url: "https://c" });

    const view = await store.getProduct(product.id);
    assert.equal(view?.offerCount, 3);
    assert.equal(view?.lowestPrice, 15000);
    assert.equal(view?.highestPrice, 20000);

    const offers = await store.listOffers(product.id);
    assert.deepEqual(
      offers.map((o) => o.shop),
      ["A샵", "C샵", "B샵"], // cheapest first
    );
  });

  it("returns null / empty for a missing product", async () => {
    assert.equal(await store.getProduct("missing"), null);
    assert.deepEqual(await store.listOffers("missing"), []);
  });
});

describe("chat (conversations + messages)", () => {
  async function seedItem(sellerId = "seller") {
    return store.createItem({
      title: "강아지 방석",
      description: "포근해요",
      price: 15000,
      category: "기타",
      imageUrl: "",
      location: "서울",
      sellerId,
      sellerName: sellerId,
    });
  }

  it("creates a conversation once and reuses it (dedupe)", async () => {
    const item = await seedItem("seller");
    const c1 = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    const c2 = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    assert.equal(c1.id, c2.id, "same buyer+item reuses the thread");

    // A different buyer gets a separate thread.
    const c3 = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer2", sellerId: "seller" });
    assert.notEqual(c3.id, c1.id);
  });

  it("appends messages oldest-first within a thread", async () => {
    const item = await seedItem("seller");
    const c = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    await store.sendMessage({ conversationId: c.id, senderId: "buyer", text: "안녕하세요, 구매 가능할까요?" });
    await store.sendMessage({ conversationId: c.id, senderId: "seller", text: "네 가능합니다!" });

    const msgs = await store.listMessages(c.id);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].text, "안녕하세요, 구매 가능할까요?"); // oldest first
    assert.equal(msgs[1].senderId, "seller");
  });

  it("lists a thread with the other participant, item + last message", async () => {
    const item = await seedItem("seller");
    const c = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    await store.sendMessage({ conversationId: c.id, senderId: "buyer", text: "질문 있어요" });

    const forBuyer = await store.listConversations("buyer");
    assert.equal(forBuyer.length, 1);
    assert.equal(forBuyer[0].otherUserId, "seller"); // buyer sees the seller
    assert.equal(forBuyer[0].itemTitle, "강아지 방석");
    assert.equal(forBuyer[0].lastMessageText, "질문 있어요");

    const forSeller = await store.listConversations("seller");
    assert.equal(forSeller[0].otherUserId, "buyer"); // seller sees the buyer
  });

  it("restricts a conversation to its participants", async () => {
    const item = await seedItem("seller");
    const c = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    assert.ok(await store.getConversationForUser(c.id, "buyer"));
    assert.ok(await store.getConversationForUser(c.id, "seller"));
    assert.equal(await store.getConversationForUser(c.id, "stranger"), null);
  });

  it("keeps the thread after the item is deleted (itemTitle → null)", async () => {
    const item = await seedItem("seller");
    const c = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    await store.sendMessage({ conversationId: c.id, senderId: "buyer", text: "안녕" });

    await store.deleteItem(item.id);
    const list = await store.listConversations("buyer");
    assert.equal(list.length, 1);
    assert.equal(list[0].itemTitle, null); // item gone, thread stays
    assert.equal(list[0].lastMessageText, "안녕");
  });

  it("counts unread from the other party and clears on read", async () => {
    const tick = () => new Promise((r) => setTimeout(r, 6));
    const item = await seedItem("seller");
    const c = await store.getOrCreateConversation({ itemId: item.id, buyerId: "buyer", sellerId: "seller" });
    await store.sendMessage({ conversationId: c.id, senderId: "seller", text: "안녕하세요" });
    await store.sendMessage({ conversationId: c.id, senderId: "seller", text: "구매 원하시나요?" });

    // Buyer has 2 unread; the seller (sender) has 0.
    assert.equal((await store.listConversations("buyer"))[0].unreadCount, 2);
    assert.equal((await store.listConversations("seller"))[0].unreadCount, 0);
    assert.equal(await store.getTotalUnread("buyer"), 2);

    // Reading the thread clears it; a later message counts again.
    await store.markConversationRead(c.id, "buyer");
    assert.equal(await store.getTotalUnread("buyer"), 0);
    await tick();
    await store.sendMessage({ conversationId: c.id, senderId: "seller", text: "재고 있어요" });
    assert.equal(await store.getTotalUnread("buyer"), 1);

    // The buyer's own message never counts as unread for the buyer.
    await store.sendMessage({ conversationId: c.id, senderId: "buyer", text: "네 살게요" });
    const after = await store.getConversationForUser(c.id, "buyer");
    assert.equal(after?.unreadCount, 1);
  });

  it("sums unread across multiple conversations", async () => {
    const a = await seedItem("s1");
    const b = await seedItem("s2");
    const ca = await store.getOrCreateConversation({ itemId: a.id, buyerId: "buyer", sellerId: "s1" });
    const cb = await store.getOrCreateConversation({ itemId: b.id, buyerId: "buyer", sellerId: "s2" });
    await store.sendMessage({ conversationId: ca.id, senderId: "s1", text: "1" });
    await store.sendMessage({ conversationId: cb.id, senderId: "s2", text: "2" });
    await store.sendMessage({ conversationId: cb.id, senderId: "s2", text: "3" });
    assert.equal(await store.getTotalUnread("buyer"), 3);
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
