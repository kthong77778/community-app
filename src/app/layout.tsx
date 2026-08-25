import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "Next.js로 만든 간단한 커뮤니티 앱",
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
