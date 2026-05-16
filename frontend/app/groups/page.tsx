"use client";

import { useEffect, useState, useCallback, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  createGroup, joinGroup, getMyGroups, getGroupLeaderboard, leaveGroup, nudgeGroup,
  Group, GroupLeaderboard,
} from "@/lib/api";
import ShareSheet from "@/components/ShareSheet";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import PageLoadProgress from "@/components/PageLoadProgress";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";
import { clearAllTabSnapshots, peekGroupsSnapshot, saveGroupsSnapshot } from "@/lib/tab-session-cache";

export default function GroupsPage() {
  const router = useRouter();
  const [token, setToken]                     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [revalidating, setRevalidating]       = useState(false);
  const [groups, setGroups]                   = useState<Group[] | null>(null);
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [leaderboard, setLeaderboard]         = useState<GroupLeaderboard | null>(null);
  const [lbLoading, setLbLoading]             = useState(false);
  const [groupName, setGroupName]             = useState("");
  const [joinCode, setJoinCode]               = useState("");
  const [msg, setMsg]                         = useState<{ text: string; ok: boolean } | null>(null);
  const [mode, setMode]                       = useState<"list" | "create" | "join">("list");
  const [nudgeLoading, setNudgeLoading]       = useState(false);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadGroups = useCallback(async (tk: string) => {
    setRevalidating(true);
    try {
      const list = await getMyGroups(tk);
      setGroups(list);
      saveGroupsSnapshot(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].group_id);
    } catch {
      setGroups([]);
    } finally {
      setRevalidating(false);
    }
  }, [selectedId]);

  useLayoutEffect(() => {
    const s = peekGroupsSnapshot();
    if (s) {
      setGroups(s.groups);
      if (s.groups.length > 0) setSelectedId(s.groups[0].group_id);
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async (tk: string, gid: string) => {
    setLbLoading(true);
    try {
      const lb = await getGroupLeaderboard(tk, gid);
      setLeaderboard(lb);
    } catch { /* ignore */ }
    finally { setLbLoading(false); }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        router.replace("/");
        setLoading(false);
        return;
      }
      setToken(session.access_token);
      void loadGroups(session.access_token).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      if (event === "INITIAL_SESSION" && !session) {
        router.replace("/");
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" && session) {
        setToken(session.access_token);
        await loadGroups(session.access_token);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, loadGroups]);

  useEffect(() => {
    if (token && selectedId) loadLeaderboard(token, selectedId);
  }, [token, selectedId, loadLeaderboard]);

  const handleCreate = async () => {
    if (!token || !groupName.trim()) return;
    try {
      const res = await createGroup(token, groupName.trim());
      setGroupName(""); setMode("list");
      showMsg(`✅ "${groupName}" 그룹 생성! 코드: ${res.invite_code}`, true);
      await loadGroups(token);
      setSelectedId(res.group_id);
    } catch (e: unknown) { showMsg(e instanceof Error ? e.message : "생성 실패", false); }
  };

  const handleJoin = async () => {
    if (!token || joinCode.length !== 6) return;
    try {
      const res = await joinGroup(token, joinCode);
      setJoinCode(""); setMode("list");
      showMsg(`✅ "${res.group_name}" 합류!`, true);
      await loadGroups(token);
      setSelectedId(res.group_id);
    } catch (e: unknown) { showMsg(e instanceof Error ? e.message : "가입 실패", false); }
  };

  const handleNudge = async (gid: string) => {
    if (!token) return;
    setNudgeLoading(true);
    try {
      const res = await nudgeGroup(token, gid);
      showMsg(res.message, res.ok);
      if (res.notified > 0) await loadLeaderboard(token, gid);
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "독촉 실패", false);
    } finally {
      setNudgeLoading(false);
    }
  };

  const handleLeave = async (gid: string) => {
    if (!token) return;
    await leaveGroup(token, gid);
    if (selectedId === gid) { setSelectedId(null); setLeaderboard(null); }
    await loadGroups(token);
    showMsg("그룹에서 탈퇴했어요", true);
  };

  const inviteUrl = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : "";

  const medals = ["🥇", "🥈", "🥉"];
  const groupList = groups ?? [];

  if (loading && groups === null) {
    return <PageLoadProgress label="그룹 불러오는 중…" accent="green" />;
  }

  return (
    <main className="relative max-w-md mx-auto min-h-screen pb-28 px-5 text-white">
      <StaleRefreshIndicator show={revalidating && groups !== null} tone="emerald" />
      <AppAmbientBackground />
      <div className="relative z-10">
      {/* 플로팅 토스트 */}
      {msg && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[70] max-w-sm w-[calc(100%-2rem)] px-5 py-3.5 rounded-2xl text-sm font-bold text-center shadow-lg transition-all animate-[fadeUp_0.25s_ease-out] ${msg.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {msg.text}
        </div>
      )}
      {/* 헤더 */}
      <div className="pt-8 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">👥 그룹 대결</h1>
          <p className="text-xs text-gray-400 mt-1">친구를 초대해 그룹 내 순위를 겨뤄보세요</p>
        </div>
        <button
          onClick={() => setMode("create")}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/40 rounded-xl transition-all active:scale-95"
        >
          ＋ 그룹 추가
        </button>
      </div>


      {/* 그룹 없을 때 온보딩 */}
      {groupList.length === 0 && mode === "list" && (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="text-6xl">🏆</span>
          <div>
            <p className="font-black text-lg">아직 그룹이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">그룹을 만들거나 초대 링크로 참여하세요</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => setMode("create")}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 font-black rounded-2xl transition-all active:scale-95">
              ＋ 그룹 만들기
            </button>
            <button onClick={() => setMode("join")}
              className="flex-1 py-4 bg-[#1A1A1A] border border-[#333] font-black rounded-2xl hover:border-blue-500/50 transition-all active:scale-95">
              코드로 참여
            </button>
          </div>
        </div>
      )}

      {/* 그룹 만들기 폼 */}
      {mode === "create" && (
        <div className="space-y-4">
          <button onClick={() => setMode("list")} className="text-xs text-gray-500 hover:text-white transition-colors">← 뒤로</button>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 space-y-4">
            <p className="font-black text-sm">새 그룹 만들기</p>
            <input
              value={groupName} onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="그룹 이름 (예: 주식 동아리, 팀 A)"
              className="w-full bg-[#252525] border border-[#333] rounded-xl px-4 py-3.5 text-sm placeholder-gray-600 outline-none focus:border-green-500/60"
              maxLength={20}
            />
            <button onClick={handleCreate} disabled={!groupName.trim()}
              className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-[#252525] disabled:text-gray-600 font-black rounded-2xl transition-all active:scale-95">
              그룹 만들기
            </button>
          </div>
        </div>
      )}

      {/* 코드로 참여 폼 */}
      {mode === "join" && (
        <div className="space-y-4">
          <button onClick={() => setMode("list")} className="text-xs text-gray-500 hover:text-white transition-colors">← 뒤로</button>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 space-y-4">
            <p className="font-black text-sm">초대 코드로 참여</p>
            <input
              value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="초대 코드 6자리"
              className="w-full bg-[#252525] border border-[#333] rounded-xl px-4 py-3.5 text-sm placeholder-gray-600 outline-none focus:border-blue-500/60 font-mono tracking-[0.3em] text-center text-lg"
              maxLength={6}
            />
            <button onClick={handleJoin} disabled={joinCode.length !== 6}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-[#252525] disabled:text-gray-600 font-black rounded-2xl transition-all active:scale-95">
              참여하기
            </button>
          </div>
        </div>
      )}

      {/* 그룹 있을 때 */}
      {groupList.length > 0 && mode === "list" && (
        <div className="space-y-4">
          {/* 그룹 탭 (여러 그룹) */}
          {groupList.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {groupList.map((g) => (
                <button key={g.group_id} onClick={() => setSelectedId(g.group_id)}
                  className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all ${selectedId === g.group_id ? "bg-green-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}>
                  {g.name}
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full ${selectedId === g.group_id ? "bg-white/20 text-white" : "bg-[#2A2A2A] text-gray-500"}`}>
                    {g.member_count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 선택된 그룹 정보 */}
          {selectedId && (() => {
            const g = groupList.find((x) => x.group_id === selectedId);
            if (!g) return null;
            return (
              <>
                {/* 그룹 헤더 + 초대 — 통합 카드 */}
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
                  {/* 그룹명 + 메타 */}
                  <div className="px-5 pt-5 pb-4 border-b border-[#2A2A2A]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black text-white leading-tight truncate">{g.name}</h2>
                        <p className="text-xs text-gray-500 mt-1">
                          {g.member_count}명 참여 &middot; {g.is_owner ? "👑 방장" : "멤버"}
                        </p>
                      </div>
                      <button onClick={() => handleLeave(g.group_id)}
                        className="text-[10px] text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                        탈퇴
                      </button>
                    </div>
                  </div>

                  {/* 초대 코드 + 공유 — 한 덩어리로 */}
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-500 mb-1">초대 코드</p>
                      <p className="font-mono font-black text-xl text-white tracking-[0.25em]">{g.invite_code}</p>
                    </div>
                    <ShareSheet
                      url={inviteUrl(g.invite_code)}
                      title="투자를 잘하거나 못하는 친구가 있나요?"
                      text={`코스피 예측 그룹 "${g.name}"에 초대합니다! 함께 예측 대결해봐요 🏆`}
                      renderTrigger={(onClick) => (
                        <button
                          onClick={onClick}
                          className="flex flex-col items-center gap-1 px-4 py-3 bg-green-600 hover:bg-green-500 active:scale-95 rounded-2xl transition-all"
                        >
                          <span className="text-lg">🔗</span>
                          <span className="text-[10px] font-black text-white whitespace-nowrap">초대하기</span>
                        </button>
                      )}
                    />
                  </div>
                </div>

                {/* 리더보드 */}
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">🏆 그룹 순위</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        누적 적중률 높은 순 &middot; 동률 시 참여일 수 많은 순
                      </p>
                    </div>
                    {/* 독촉 버튼 */}
                    {leaderboard && leaderboard.members.some((m) => !m.is_me && !m.voted_today) && (
                      <button
                        onClick={() => handleNudge(g.group_id)}
                        disabled={nudgeLoading}
                        className="flex items-center gap-1.5 text-xs font-black px-3 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/40 active:scale-95 rounded-xl transition-all disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                      >
                        {nudgeLoading ? (
                          <span className="w-3 h-3 border border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                        ) : "📣"}
                        설문 독촉하기
                      </button>
                    )}
                    {leaderboard && leaderboard.members.every((m) => m.is_me || m.voted_today) && (
                      <span className="text-[10px] text-green-400 font-bold flex-shrink-0">✅ 모두 참여</span>
                    )}
                  </div>

                  {lbLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                    </div>
                  ) : leaderboard ? (
                    <>
                      {/* 포디움 (3명 이상) */}
                      {leaderboard.members.length >= 2 && (() => {
                        const top3 = leaderboard.members.slice(0, Math.min(3, leaderboard.members.length));
                        // 시각적 순서: 2위(left) → 1위(center) → 3위(right)
                        const order = top3.length >= 3 ? [1, 0, 2] : [0, 1];
                        // ri = 데이터 인덱스 (0=1위, 1=2위, 2=3위) — 직접 매핑
                        const heights      = ["h-24", "h-20", "h-16"];
                        const borderColors = ["border-yellow-400/50", "border-gray-300/30", "border-amber-600/40"];
                        return (
                          <div className="flex items-end justify-center gap-2 px-5 py-5">
                            {order.map((ri) => {
                              const m = top3[ri];
                              if (!m) return <div key={ri} className="flex-1" />;
                              return (
                                <div key={ri} className="flex-1 flex flex-col items-center gap-1">
                                  {m.is_me && <span className="text-[9px] text-green-400 font-bold">나</span>}
                                  <span className="text-xl">{medals[ri]}</span>
                                  <p className="text-[10px] text-gray-300 font-bold truncate max-w-full px-1">{m.masked_name}</p>
                                  <div className={`w-full ${heights[ri]} rounded-t-lg border ${borderColors[ri]} flex items-end justify-center pb-2 ${m.is_me ? "bg-green-500/20" : "bg-[#252525]"}`}>
                                    <span className="text-xs font-black">{m.accuracy !== null ? `${m.accuracy}%` : "신규"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* 전체 목록 */}
                      <div className="border-t border-[#222]">
                        <div className="grid grid-cols-[28px_1fr_44px_44px_44px] text-[10px] text-gray-600 px-4 py-2">
                          <span>#</span><span>닉네임</span><span className="text-right">적중률</span><span className="text-right">참여</span><span className="text-center">설문여부</span>
                        </div>
                        <div className="divide-y divide-[#222]">
                          {leaderboard.members.map((m, i) => (
                            <div key={m.user_id} className={`grid grid-cols-[28px_1fr_44px_44px_44px] items-center px-4 py-3 ${m.is_me ? "bg-green-500/10 border-l-2 border-green-500" : ""}`}>
                              <span className="text-sm">{i < 3 ? medals[i] : <span className="text-gray-500 text-xs">{i + 1}</span>}</span>
                              <span className="text-sm font-bold flex items-center gap-1.5 truncate">
                                {m.masked_name}
                                {m.is_me && <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-black flex-shrink-0">나</span>}
                              </span>
                              <span className={`text-xs font-black text-right ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-400"}`}>
                                {m.accuracy !== null ? `${m.accuracy}%` : "신규"}
                              </span>
                              <span className="text-[10px] text-gray-600 text-right">{m.total_predictions}일</span>
                              {/* 오늘 참여 여부 */}
                              <span className="text-center text-xs">
                                {m.voted_today ? "✅" : <span className="text-gray-600">⬜</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-600 text-center py-8">데이터를 불러오는 중...</p>
                  )}
                </div>

                {/* 코드 없이 참여 버튼 */}
                <button onClick={() => setMode("join")}
                  className="w-full py-3.5 bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400 hover:text-white font-bold rounded-2xl text-sm transition-all">
                  + 다른 그룹 코드로 참여
                </button>
              </>
            );
          })()}
        </div>
      )}

      </div>

      <AppTabNav />
    </main>
  );
}
