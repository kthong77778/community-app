import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";

// Always render fresh — the database changes as users post.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  // The web view shows the most recent posts; the mobile app paginates.
  const { posts } = await getStore().listPostViews({
    limit: 50,
    offset: 0,
    currentUserId: user?.id ?? null,
  });

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">전체 글</h1>
        <Link href="/posts/new" className="btn btn-primary btn-sm">
          글쓰기
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          아직 게시글이 없습니다.
          <br />첫 글을 남겨보세요!
        </div>
      ) : (
        <div className="post-list">
          {posts.map((p) => (
            <Link key={p.id} href={`/posts/${p.id}`}>
              <article className="post-card">
                <h3>{p.title}</h3>
                <p className="post-excerpt">{p.content}</p>
                <div className="post-meta">
                  <span>{p.authorName}</span>
                  <span className="dot">{timeAgo(p.createdAt)}</span>
                  <span className="meta-stat dot">♥ {p.likeCount}</span>
                  <span className="meta-stat">💬 {p.commentCount}</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
