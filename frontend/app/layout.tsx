import type { Metadata } from "next";
import "./globals.css";
import InAppBrowserGate from "@/components/InAppBrowserGate";

export const metadata: Metadata = {
  title: "오늘 장 예측 | 코스피 집단지성",
  description: "매일 08:48 코스피 예측에 참여하고, 내 정확도와 순위를 확인하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-[#0D0D0D] text-white min-h-screen">
        <InAppBrowserGate>{children}</InAppBrowserGate>
      </body>
    </html>
  );
}
