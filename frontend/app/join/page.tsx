"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { joinGroup } from "@/lib/api";

export default function JoinPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const code         = (searchParams.get("code") || "").toUpperCase();

  const [status, setStatus] = useState<"loading" | "joining" | "success" | "error" | "no_code">("loading");
  const [groupName, setGroupName] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");

  useEffect(() => {
    if (!code) {
      setStatus("no_code");
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // 로그인 후 이 페이지로 돌아오도록 코드 저장
        localStorage.setItem("pending_join_code", code);
        router.replace(`/?redirect=/join?code=${code}`);
        return;
      }

      setStatus("joining");
      try {
        const res = await joinGroup(session.access_token, code);
        setGroupName(res.group_name);
        setStatus("success");
        // 2초 후 대시보드로 이동
        setTimeout(() => router.replace("/dashboard"), 2000);
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "가입에 실패했어요");
        setStatus("error");
      }
    });
  }, [code, router]);

  // 화면 공통 래퍼
  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <main className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6 bg-[#111]">
      <div className="w-full text-center space-y-5">{children}</div>
    </main>
  );

  if (status === "no_code") return (
    <Wrap>
      <div className="text-5xl">❓</div>
      <p className="text-lg font-black text-white">초대 코드가 없어요</p>
      <p className="text-sm text-gray-400">올바른 초대 링크로 접속해주세요.</p>
      <button onClick={() => router.replace("/dashboard")} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl">
        대시보드로 →
      </button>
    </Wrap>
  );

  if (status === "loading" || status === "joining") return (
    <Wrap>
      <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
      <p className="text-white font-bold">{status === "joining" ? "그룹에 참여하는 중..." : "로딩 중..."}</p>
      <p className="text-sm text-gray-500">코드: <span className="text-white font-mono">{code}</span></p>
    </Wrap>
  );

  if (status === "success") return (
    <Wrap>
      <div className="text-6xl animate-bounce">🎉</div>
      <p className="text-xl font-black text-white">{groupName} 합류 완료!</p>
      <p className="text-sm text-gray-400">대시보드에서 그룹 순위를 확인해보세요 🏆</p>
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
    </Wrap>
  );

  return (
    <Wrap>
      <div className="text-5xl">⚠️</div>
      <p className="text-lg font-black text-white">가입 실패</p>
      <p className="text-sm text-red-400">{errorMsg}</p>
      <button onClick={() => router.replace("/dashboard")} className="w-full py-4 bg-[#1A1A1A] border border-[#333] text-white font-black rounded-2xl">
        대시보드로 →
      </button>
    </Wrap>
  );
}
