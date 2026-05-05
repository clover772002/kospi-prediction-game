"use client";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/setup",     label: "설정",     icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#222] z-50">
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
