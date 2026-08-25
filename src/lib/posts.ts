import { getStore } from "./store";
import type { Post, PostView } from "./store/types";

// Enrich a raw Post with the derived counts the UI needs.
export function toPostView(
  post: Post,
  commentCount: number,
  currentUserId: string | null,
): PostView {
  return {
    ...post,
    likeCount: post.likedBy.length,
    commentCount,
    likedByMe: currentUserId ? post.likedBy.includes(currentUserId) : false,
  };
}

// Build PostViews for a list of posts in one pass, sharing the comment counts.
export async function listPostViews(
  currentUserId: string | null,
): Promise<PostView[]> {
  const store = getStore();
  const [posts, commentCounts] = await Promise.all([
    store.listPosts(),
    store.countCommentsByPost(),
  ]);
  return posts.map((p) =>
    toPostView(p, commentCounts[p.id] ?? 0, currentUserId),
  );
}
