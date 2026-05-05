"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, unlinkTelegram, getVapidPublicKey, savePushSubscription, deletePushSubscription, UserProfile } from "@/lib/api";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Profitchat123bot";

function openInExternalBrowser() {
  const url = window.location.href;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    window.location.href = `googlechrome://${url.replace(/^https?:\/\//, "")}`;
    setTimeout(() => { window.location.href = url; }, 1000);
  }
}

export default function SetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [botOpened, setBotOpened] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [tab, setTab] = useState<"telegram" | "webpush">("telegram");
  const [pushLinked, setPushLinked] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/");
        return;
      }
      if (event === "INITIAL_SESSION" && !session) {
        router.replace("/");
        return;
      }
      if (session) {
        setToken(session.access_token);
        try {
          const profile = await getMe(session.access_token);
          setUser(profile);
          if (profile.telegram_chat_id) {
            setLinked(true);
          }
          if (profile.has_push) {
            setPushLinked(true);
            setTab("webpush");
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const botLink = user ? `https://t.me/${BOT_USERNAME}?start=${user.id}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(botLink);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const checkLink = useCallback(async () => {
    if (!token) return;
    setChecking(true);
    setCheckFailed(false);
    try {
      const profile = await getMe(token);
      if (profile.telegram_chat_id) {
        setLinked(true);
        setUser(profile);
      } else {
        setCheckFailed(true);
      }
    } catch (e) {
      console.error(e);
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  }, [token]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5">
      {/* ?ㅻ뜑 */}
      <div className="pt-8 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">?뵒 ?뚮┝ ?ㅼ젙</h1>
          <p className="text-xs text-gray-400 mt-1">08:48 ?ㅻЦ??諛쏆쓣 諛⑸쾿???곌껐?댁＜?몄슂</p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          濡쒓렇?꾩썐
        </button>
      </div>

      {/* ?좎? ?뺣낫 */}
      {user && (
        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A] mb-6">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          {(linked || pushLinked) ? (
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-xs text-green-400 font-bold">???곕룞??/span>
              <span className="text-xs text-gray-500">
                {linked && pushLinked ? "?붾젅洹몃옩 쨌 釉뚮씪?곗?" : linked ? "?붾젅洹몃옩" : "釉뚮씪?곗? ?뚮┝"}
              </span>
            </div>
          ) : (
            <span className="ml-auto text-xs text-gray-500 flex-shrink-0">誘몄뿰??/span>
          )}
        </div>
      )}

      {/* ?뚮┝ 諛⑹떇 ??*/}
      {!linked && !pushLinked && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setTab("telegram")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === "telegram" ? "bg-blue-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
          >
            ?덌툘 ?붾젅洹몃옩 遊?          </button>
          <button
            onClick={() => setTab("webpush")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === "webpush" ? "bg-purple-600 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]"}`}
          >
            ?뵒 釉뚮씪?곗? ?뚮┝
          </button>
        </div>
      )}

      {linked ? (
        /* ?곕룞 ?꾨즺 ?곹깭 */
        <div className="space-y-5">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">??/div>
            <p className="font-black text-lg text-green-400">?붾젅洹몃옩 ?곕룞 ?꾨즺!</p>
            <p className="text-sm text-gray-400">
              留ㅼ씪 <span className="text-white font-bold">08:48</span>??br />
              肄붿뒪???덉륫 ?ㅻЦ??諛쒖넚?⑸땲??
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95"
          >
            ????쒕낫?쒕줈 ?대룞
          </button>

          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] space-y-2 text-sm text-gray-400">
            <p className="font-bold text-white">?ㅻЦ ?쇱젙</p>
            <div className="space-y-1">
              <p>?븲 <span className="text-white">08:48</span> - 肄붿뒪???덉륫 ?ㅻЦ 諛쒖넚</p>
              <p>?븯 <span className="text-white">09:00</span> - ?ㅻЦ 留덇컧 + 吏묎퀎 寃곌낵 怨듦컻</p>
              <p>?븩 <span className="text-white">15:35</span> - ?ㅼ젣 寃곌낵 + ???뺥솗???뚮┝</p>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!token) return;
              if (!confirm("?붾젅洹몃옩 ?곕룞???댁젣?섎㈃ ?ㅻЦ??諛쏆쓣 ???놁뼱?? ?댁젣?좉퉴??")) return;
              setUnlinking(true);
              try {
                await unlinkTelegram(token);
                setLinked(false);
                setBotOpened(false);
                setCheckFailed(false);
                setUser(prev => prev ? { ...prev, telegram_chat_id: null } : prev);
              } catch (e) {
                console.error(e);
                alert("?댁젣 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.");
              } finally {
                setUnlinking(false);
              }
            }}
            disabled={unlinking}
            className="w-full py-3 bg-[#1A1A1A] border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 rounded-xl text-sm transition-all disabled:opacity-40"
          >
            {unlinking ? "?댁젣 以?.." : "?붾젅洹몃옩 ?곕룞 ?댁젣"}
          </button>
        </div>
      ) : pushLinked ? (
        /* ???몄떆 ?곕룞 ?꾨즺 */
        <div className="space-y-5">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">?뵒</div>
            <p className="font-black text-lg text-purple-400">釉뚮씪?곗? ?뚮┝ ?곌껐 ?꾨즺!</p>
            <p className="text-sm text-gray-400">留ㅼ씪 <span className="text-white font-bold">08:48</span>???뚮┝???꾩갑?⑸땲??</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95">
            ????쒕낫?쒕줈 ?대룞
          </button>
          <button
            onClick={async () => {
              if (!token) return;
              if (!confirm("釉뚮씪?곗? ?뚮┝ ?곌껐???댁젣?좉퉴??")) return;
              await deletePushSubscription(token);
              setPushLinked(false);
            }}
            className="w-full py-3 bg-[#1A1A1A] border border-red-500/20 text-red-400/60 hover:text-red-400 rounded-xl text-sm transition-all"
          >
            釉뚮씪?곗? ?뚮┝ ?댁젣
          </button>
        </div>
      ) : tab === "webpush" ? (
        /* ???몄떆 ?곕룞 ?덈궡 */
        (() => {
          const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
          const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
          const isInApp = typeof navigator !== "undefined" && /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);

          return (
            <div className="space-y-4">
              {/* ?덈궡: ?ㅻЦ? ?깆뿉??吏곸젒 */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2 items-start">
                <span className="text-base flex-shrink-0">?뮕</span>
                <p className="text-xs text-blue-300 leading-relaxed">
                  釉뚮씪?곗? ?뚮┝? ?ㅻЦ ?쒓컙??<span className="text-white font-bold">?뚮젮二쇰뒗 ??븷</span>留??댁슂.<br />
                  ?뚮┝????븯硫??깆쑝濡??대룞?섍퀬, <span className="text-white font-bold">?ㅻЦ ??뿉???덉륫</span>?섎㈃ ?쇱슂.
                </p>
              </div>

              {/* ?몄빋 釉뚮씪?곗? 寃쎄퀬 */}
              {isInApp && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-yellow-400 text-sm font-bold">?좑툘 ???댁뿉?쒕뒗 釉뚮씪?곗? ?뚮┝ ?ъ슜 遺덇?</p>
                  <p className="text-xs text-gray-400">Chrome ?먮뒗 Safari?먯꽌留??묐룞?댁슂.</p>
                  <button
                    onClick={openInExternalBrowser}
                    className="w-full py-3 bg-white text-gray-900 font-bold rounded-xl text-sm active:scale-95 transition-all"
                  >
                    ?뙋 Chrome / Safari濡??닿린
                  </button>
                  <p className="text-xs text-gray-600 text-center">踰꾪듉?????섎㈃ ?붾젅洹몃옩 遊???쓣 ?댁슜?댁＜?몄슂</p>
                </div>
              )}

              {/* iPhone ???꾩쭅 ???붾㈃??異붽? ????寃쎌슦 */}
              {isIOS && !isStandalone && !isInApp && (
                <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">?뜋</span>
                    <p className="font-bold text-orange-300 text-sm">iPhone ?ъ슜???꾨룆</p>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    iPhone? Safari?먯꽌 <span className="text-white font-bold">???붾㈃??異붽?</span>?????깆쓣 ?댁뼱??釉뚮씪?곗? ?뚮┝???ъ슜?????덉뼱??
                  </p>
                  <ol className="space-y-3 text-xs text-gray-300">
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Safari ?섎떒 媛?대뜲 <span className="text-white font-bold">怨듭쑀 踰꾪듉</span> (?△넁) ??/span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>?ㅽ겕濡ㅽ빐??<span className="text-white font-bold">???붾㈃??異붽?</span> ?좏깮 ??異붽?</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>???붾㈃???앷릿 <span className="text-white font-bold">???꾩씠肄?/span>?쇰줈 ?묒냽</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0 text-xs">4</span>
                      <span>?ㅼ젙 ??釉뚮씪?곗? ?뚮┝ ??뿉??<span className="text-white font-bold">?뚮┝ ?덉슜</span></span>
                    </li>
                  </ol>
                  <button
                    onClick={() => {
                      if (typeof navigator !== "undefined") {
                        navigator.clipboard.writeText(window.location.href).catch(() => {});
                        alert("二쇱냼媛 蹂듭궗?먯뼱??\nSafari 二쇱냼李쎌뿉 遺숈뿬?ｊ린 ?????붾㈃??異붽??댁＜?몄슂 ?벑");
                      }
                    }}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl text-sm active:scale-95 transition-all"
                  >
                    ?뱥 ???섏씠吏 二쇱냼 蹂듭궗?섍린
                  </button>
                  <p className="text-xs text-gray-600 text-center">蹂듭궗 ??Safari 二쇱냼李쎌뿉 遺숈뿬?ｊ린 ?????붾㈃??異붽?</p>
                </div>
              )}

              {/* ?뚮┝ ?덉슜 踰꾪듉 ??iOS ?덊솕硫??깆씠嫄곕굹 Android/PC */}
              {(!isIOS || isStandalone) && !isInApp && (
                <>
                  <button
                    onClick={async () => {
                      if (!token) return;
                      setPushLoading(true);
                      setPushError(null);
                      try {
                        if (typeof window === "undefined" || !("Notification" in window)) {
                          setPushError("??釉뚮씪?곗????뚮┝??吏?먰븯吏 ?딆븘?? Chrome ?먮뒗 Edge瑜??ъ슜?댁＜?몄슂.");
                          return;
                        }
                        if (!("serviceWorker" in navigator)) {
                          setPushError("??釉뚮씪?곗???Service Worker瑜?吏?먰븯吏 ?딆븘??");
                          return;
                        }
                        const permission = await window.Notification.requestPermission();
                        if (permission !== "granted") {
                          setPushError("?뚮┝ 沅뚰븳??嫄곕??먯뼱?? 釉뚮씪?곗? ?ㅼ젙?먯꽌 ?덉슜?댁＜?몄슂.");
                          return;
                        }
                        const reg = await navigator.serviceWorker.register("/sw.js");
                        await navigator.serviceWorker.ready;
                        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                          || await getVapidPublicKey();
                        if (!vapidKey) {
                          setPushError("?쒕쾭 ?ㅼ젙 ?ㅻ쪟?낅땲?? ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.");
                          return;
                        }
                        const keyBytes = Uint8Array.from(
                          atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")),
                          (c) => c.charCodeAt(0)
                        );
                        const sub = await reg.pushManager.subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: keyBytes,
                        });
                        await savePushSubscription(token, sub.toJSON());
                        setPushLinked(true);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setPushError("?뚮┝ ?곌껐???ㅽ뙣?덉뼱?? " + msg);
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    disabled={pushLoading}
                    className="w-full py-5 bg-purple-600 hover:bg-purple-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-black text-xl rounded-2xl transition-all active:scale-95"
                  >
                    {pushLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ?곌껐 以?..
                      </span>
                    ) : "?뵒 釉뚮씪?곗? ?뚮┝ ?덉슜?섍린"}
                  </button>
                  {pushError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-400 text-xs">{pushError}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()
      ) : (
        /* ?곕룞 ?덈궡 ??2?④퀎 UI */
        <div className="space-y-4">
          {!botOpened ? (
            /* ?? STEP 1: 遊??닿린 ?? */
            <>
              {/* 嫄곕?媛??댁냼 ?덈궡 */}
              <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A] space-y-2">
                <p className="text-xs text-gray-300 font-bold">?뱦 ?붾젅洹몃옩 遊뉗씠??</p>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li>??<span className="text-white">?щ엺???꾨땶 ?먮룞 ?꾨줈洹몃옩</span>?낅땲????梨꾪똿 ?곷?媛 ?놁뼱??/li>
                  <li>??留ㅼ씪 ?꾩묠 ?ㅻЦ 1媛쒕? 蹂대궡怨? 寃곌낵瑜??뚮젮二쇰뒗 寃??꾨??덉슂</li>
                  <li>?????곕씫泥샕룹콈???댁슜? ?꾪? 蹂댁씠吏 ?딆븘??/li>
                  <li>???몄젣??遊?李⑤떒 ??踰덉쑝濡??뚮┝???????덉뼱??/li>
                  <li>
                    <button
                      onClick={() => setTab("webpush")}
                      className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                    >
                      洹몃옒???붾젅洹몃옩??遺?대릺????釉뚮씪?곗? ?뚮┝?쇰줈!
                    </button>
                  </li>
                </ul>
              </div>

              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBotOpened(true)}
                className="flex items-center justify-center gap-2 w-full py-5 rounded-2xl font-black text-xl transition-all active:scale-95"
                style={{ backgroundColor: "#0088CC", color: "#fff" }}
              >
                <span className="text-2xl">?덌툘</span>
                ?뚮┝ 遊??곌껐?섍린
              </a>

              <button
                onClick={handleCopy}
                className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-500 hover:text-white rounded-xl text-sm transition-all"
              >
                {copyDone ? "??留곹겕 蹂듭궗?? : "?뵕 留곹겕媛 ???대━硫???蹂듭궗?섍린"}
              </button>

            </>
          ) : (
            /* ?? STEP 2: ?곕룞 ?뺤씤 ?? */
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 space-y-2">
                <p className="text-xs text-blue-400 font-bold tracking-widest uppercase">2?④퀎</p>
                <p className="font-bold text-white">?붾젅洹몃옩?먯꽌 '?쒖옉'???뚮??섏슂?</p>
                <p className="text-xs text-gray-400">遊뉗씠 ?섏쁺 硫붿떆吏瑜?蹂대깉?쇰㈃ ?꾨옒 踰꾪듉???뚮윭二쇱꽭??</p>
              </div>

              <button
                onClick={checkLink}
                disabled={checking}
                className="w-full py-5 bg-green-600 hover:bg-green-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-black text-xl rounded-2xl transition-all active:scale-95"
              >
                {checking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ?뺤씤 以?..
                  </span>
                ) : "???곕룞 ?뺤씤?섍린"}
              </button>

              {checkFailed && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
                  <p className="text-red-400 text-sm font-bold">?꾩쭅 ?곕룞?????먯뼱??/p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>???붾젅洹몃옩?먯꽌 '?쒖옉' 踰꾪듉???뚮??붿? ?뺤씤?섏꽭??/li>
                    <li>??遊뉗씠 ?섏쁺 硫붿떆吏瑜?蹂대깉?붿? ?뺤씤?섏꽭??/li>
                    <li>?????대졇?ㅻ㈃ ?꾨옒?먯꽌 ?ㅼ떆 ?쒕룄?대낫?몄슂</li>
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setBotOpened(false); setCheckFailed(false); }}
                className="w-full py-3 bg-[#1A1A1A] border border-[#333] text-gray-500 hover:text-white rounded-xl text-sm transition-all"
              >
                ??遊??ㅼ떆 ?닿린
              </button>
            </>
          )}
        </div>
      )}

      {/* ?섎떒 ?대퉬 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] z-50">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => router.push("/survey")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">?뱷</span>
            <span className="text-xs font-medium">?ㅻЦ</span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">?뱤</span>
            <span className="text-xs font-medium">??쒕낫??/span>
          </button>
          <button className="flex-1 flex flex-col items-center py-3 gap-1 text-blue-400">
            <span className="text-xl">?숋툘</span>
            <span className="text-xs font-bold">?ㅼ젙</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
