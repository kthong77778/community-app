import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { getStore } from "@/lib/store";
import { POST_CATEGORIES } from "@/lib/validation";

// Always render fresh — the database changes as users post.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: raw } = await searchParams;
  const category = POST_CATEGORIES.includes(raw as never) ? raw! : null;

  const user = await getCurrentUser();
  const { posts } = await getStore().listPostViews({
    limit: 50,
    offset: 0,
    currentUserId: user?.id ?? null,
    category,
  });

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">전체 글</h1>
        <Link href="/posts/new" className="btn btn-primary btn-sm">
          글쓰기
        </Link>
      </div>

      <nav className="filters">
        <Link href="/" className={`filter-pill ${!category ? "active" : ""}`}>
          전체
        </Link>
        {POST_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/?category=${encodeURIComponent(c)}`}
            className={`filter-pill ${category === c ? "active" : ""}`}
          >
            {c}
          </Link>
        ))}
      </nav>

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
                <div className="card-top">
                  <span className={`badge badge-${p.category}`}>{p.category}</span>
                  <h3>{p.title}</h3>
                </div>
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
