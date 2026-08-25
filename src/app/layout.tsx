import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "댕냥마을",
  description: "반려동물 애호가를 위한 커뮤니티 — 자랑·질문·후기·홍보를 나눠요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <Header />
          <main>
            <div className="container">{children}</div>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
