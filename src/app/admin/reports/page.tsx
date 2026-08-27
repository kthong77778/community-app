"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { isAdmin } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import type { ReportView } from "@/lib/store/types";

export default function AdminReportsPage() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<ReportView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden">("loading");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      setStatus("forbidden");
      return;
    }
    if (res.ok) {
      setReports((await res.json()).reports);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [loading, load]);

  if (loading || status === "loading") return <p className="muted">불러오는 중...</p>;

  if (status === "forbidden" || !isAdmin(user?.username)) {
    return (
      <div className="empty">
        관리자만 볼 수 있어요.
        <br />
        <Link href="/" className="btn btn-sm" style={{ marginTop: 12 }}>
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">🚩 신고함</h1>
        <span className="count">{reports.length}건</span>
      </div>

      {reports.length === 0 ? (
        <div className="empty">접수된 신고가 없어요.</div>
      ) : (
        <div className="report-list">
          {reports.map((r) => {
            const href =
              r.targetType === "post" ? `/posts/${r.targetId}` : `/items/${r.targetId}`;
            return (
              <Link key={r.id} href={href} className="report-row">
                <div className="report-top">
                  <span className={`report-kind ${r.targetType}`}>
                    {r.targetType === "post" ? "글" : "상품"}
                  </span>
                  <span className="report-title">{r.targetTitle ?? "삭제됨"}</span>
                  <span className="report-time">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="report-reason">{r.reason || "사유 없음"}</div>
                <div className="report-by">신고자: {r.reporterId}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
