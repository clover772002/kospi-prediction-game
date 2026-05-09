import type { Metadata } from "next";
import "./globals.css";
import InAppBrowserGate from "@/components/InAppBrowserGate";
import SWRegister from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "코스피 예측",
  description: "매일 밤 22:00 코스피 예측 설문에 참여하고, 내 정확도와 순위를 확인하세요.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "코스피 예측",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* React hydration 이전에 beforeinstallprompt 이벤트를 캡처 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e;});`,
          }}
        />
      </head>
      <body className="bg-[#0D0D0D] text-white min-h-screen">
        <SWRegister />
        <InAppBrowserGate>{children}</InAppBrowserGate>
      </body>
    </html>
  );
}
