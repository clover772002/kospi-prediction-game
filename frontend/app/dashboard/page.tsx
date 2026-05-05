"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, getToday, getDashboard, UserProfile, TodaySurvey, DashboardData } from "@/lib/api";
import FlipClock from "@/components/FlipClock";

function SentimentBar({ label, pct, result }: { label: string; pct: number | null; result?: boolean | null }) {
  const displayPct = pct ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span className="font-bold text-white">{label}</span>
        {pct !== null && (
          <span>
            ?ㅻⅨ??<span className="text-green-400 font-bold">{pct}%</span>
            {" "}vs ?대┛??<span className="text-red-400 font-bold">{100 - pct}%</span>
          </span>
        )}
      </div>
      <div className="h-3 bg-[#222] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${displayPct}%` }}
        />
      </div>
      {result !== undefined && result !== null && (
        <p className="text-xs text-right">
          ?ㅼ젣:{" "}
          <span className={result ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
            {result ? "???곸듅" : "???섎씫"}
          </span>
        </p>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: DashboardData["history"][0] }) {
  const hasResult = item.kospi_correct !== null;
  return (
    <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A]">
      <p className="text-xs text-gray-500 w-20 flex-shrink-0">{item.date.slice(5)}</p>

      <div className="flex gap-4 flex-1 text-xs">
        <div className="text-center">
          <p className="text-gray-500 mb-0.5">肄붿뒪??/p>
          <p className={item.kospi_answer ? "text-green-400" : "text-red-400"}>
            {item.kospi_answer ? "?뱢 ?ㅻ쫫" : "?뱣 ?대┝"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 text-sm">
        {hasResult ? (
          <span title="肄붿뒪??>{item.kospi_correct ? "?? : "??}</span>
        ) : (
          <span className="text-xs text-gray-600">寃곌낵 ?湲?/span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [today, setToday]     = useState<TodaySurvey | null>(null);
  const [dash, setDash]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [token, setToken]     = useState<string | null>(null);

  useEffect(() => {
    let called = false;

    const loadData = async (accessToken: string) => {
      if (called) return;
      called = true;
      setToken(accessToken);
      try {
        // 媛??붿껌??8珥???꾩븘???곸슜
        const withTimeout = <T,>(p: Promise<T>, ms = 8000): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`?붿껌 ??꾩븘??(${ms / 1000}珥?. 諛깆뿏??localhost:8000)媛 ?ㅽ뻾 以묒씤吏 ?뺤씤?댁＜?몄슂.`)), ms)
            ),
          ]);

        const [profile, todayData, dashData] = await Promise.all([
          withTimeout(getMe(accessToken)),
          withTimeout(getToday()),
          withTimeout(getDashboard(accessToken)),
        ]);
        setUser(profile);
        setToday(todayData);
        setDash(dashData);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("?곗씠??濡쒕뵫 ?ㅻ쪟:", msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    // 1) 湲곗〈 ?몄뀡 利됱떆 ?뺤씤
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadData(session.access_token);
    });

    // 2) OAuth 由щ떎?대젆?????몄뀡 媛먯?
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { router.replace("/"); return; }
      if (event === "SIGNED_IN" && session) loadData(session.access_token);
      if (event === "INITIAL_SESSION" && !session) {
        setLoading(false);
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">?곗씠??遺덈윭?ㅻ뒗 以?..</p>
          <p className="text-xs text-gray-600">10珥??대줈 ?먮룞 ?닿껐?⑸땲??/p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">?좑툘</div>
          <p className="font-bold text-lg">?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎</p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-left">
            <p className="text-red-400 text-sm font-mono break-all">{error}</p>
          </div>
          <p className="text-xs text-gray-500">
            諛깆뿏??localhost:8000)媛 ?ㅽ뻾 以묒씤吏,<br />
            Supabase SQL ?ㅽ궎留덇? ?곸슜?먮뒗吏 ?뺤씤?댁＜?몄슂.
          </p>
          <button
            onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
          >
            ?ㅼ떆 ?쒕룄
          </button>
          <button
            onClick={handleLogout}
            className="block w-full text-xs text-gray-500 hover:text-gray-300"
          >
            濡쒓렇?꾩썐
          </button>
        </div>
      </main>
    );
  }

  // ?? 釉붾윭 寃뚯씠???먯젙 ?????????????????????????????
  const isConnected = !!(user?.telegram_chat_id || user?.has_push);
  const surveyDay = today?.status !== "no_survey";
  const respondedToday = !!(
    dash?.history?.length &&
    today?.survey_date &&
    dash.history[0].date === today.survey_date
  );
  // ?곕룞 ??????理쒖슦??  const gateType: "not_connected" | "no_survey" | null =
    !isConnected ? "not_connected" :
    surveyDay && !respondedToday ? "no_survey" :
    null;

  const statusColor: Record<string, string> = {
    no_survey: "#6B7280",
    open: "#F59E0B",
    closed: "#06B6D4",
    result: "#22C55E",
  };

  const status = today?.status ?? "no_survey";

  // ?꾩옱 ?쒓컖 湲곗? ???곹깭 諛곕꼫
  function getMarketStatus(): { label: string; color: string } {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const h = kst.getHours();
    const m = kst.getMinutes();
    const mins = h * 60 + m;
    if (mins < 9 * 60) return { label: "?μ떆?묒쟾", color: "#6B7280" };
    if (mins < 15 * 60 + 30) return { label: "?μ쨷", color: "#F59E0B" };
    return { label: "?λ쭏媛?, color: "#22C55E" };
  }
  const marketStatus = getMarketStatus();

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5 relative">
      {/* ?? 釉붾윭 寃뚯씠???ㅻ쾭?덉씠 ?? */}
      {gateType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-7 w-full max-w-sm text-center space-y-5 shadow-2xl">
            {gateType === "not_connected" ? (
              <>
                <div className="text-5xl">?뵒</div>
                <p className="font-black text-xl text-white">?뚮┝ ?곕룞???꾩슂?댁슂</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  ?붾젅洹몃옩 ?먮뒗 釉뚮씪?곗? ?뚮┝???곌껐?댁빞<br />??쒕낫?쒕? 蹂????덉뼱??
                </p>
                <button
                  onClick={() => router.push("/setup")}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-base rounded-2xl transition-all active:scale-95"
                >
                  ?뚮┝ ?곕룞?섎윭 媛湲???                </button>
              </>
            ) : (
              <>
                <div className="text-5xl">?뱷</div>
                <p className="font-black text-xl text-white">?ㅻ뒛 ?ㅻЦ???댁빞 蹂????덉뼱??/p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  ?ㅻ뒛??肄붿뒪???덉륫??癒쇱? 李몄뿬?댁빞<br />吏묎퀎 寃곌낵? 怨좎닔 ?덉륫???뺤씤?????덉뼱??
                </p>
                <button
                  onClick={() => router.push("/survey")}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-black text-base rounded-2xl transition-all active:scale-95"
                >
                  ?ㅻЦ?섎윭 媛湲???                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="block w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              濡쒓렇?꾩썐
            </button>
          </div>
        </div>
      )}
      {/* ?ㅻ뜑 */}
      <div className="pt-8 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">
            {(() => {
              const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
              const mm = String(kst.getMonth() + 1).padStart(2, "0");
              const dd = String(kst.getDate()).padStart(2, "0");
              const dateStr = `${mm}/${dd}`;
              if (status === "no_survey") {
                const day = kst.getDay(); // 0=?? 6=??                const mins = kst.getHours() * 60 + kst.getMinutes();
                const isWeekend = day === 0 || day === 6;
                const beforeSurvey = mins < 8 * 60 + 48;
                if (!isWeekend && beforeSurvey) return `?뱤 ${dateStr} ?ㅻЦ ?湲곗쨷`;
                return `?뱤 ${dateStr} ?댁옣??;
              }
              return `?뱤 ${dateStr} ?덉륫寃곌낵`;
            })()}
          </h1>
          {user && (
            <p className="text-xs text-gray-400 mt-0.5">
              {user.name || user.email}
            </p>
          )}
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          濡쒓렇?꾩썐
        </button>
      </div>

      <div className="space-y-4">
        {/* ?? ?ㅻ뒛??吏묎퀎 ??????????????????????????????????? */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            borderColor: `${statusColor[status]}40`,
            backgroundColor: `${statusColor[status]}08`,
          }}
        >
          {(() => {
            const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const day = kst.getDay();
            const mins = kst.getHours() * 60 + kst.getMinutes();
            const isWeekend = day === 0 || day === 6;
            const beforeSurvey = mins < 8 * 60 + 48;
            const isPreSurvey = status === "no_survey" && !isWeekend && beforeSurvey;
            const isHoliday = status === "no_survey" && !isPreSurvey;
            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-sm">
                    {isPreSurvey ? "?ㅻЦ ?湲곗쨷" : isHoliday ? "?ㅻ뒛 ?댁옣" : "?ㅼ쟻 / ?꾨쭩"}
                  </p>
                  {!isHoliday && !isPreSurvey && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-bold"
                      style={{ backgroundColor: `${marketStatus.color}20`, color: marketStatus.color }}
                    >
                      {marketStatus.label}
                    </span>
                  )}
                  {isPreSurvey && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-500/20 text-blue-400">
                      08:48 ?쒖옉
                    </span>
                  )}
                </div>

                {isPreSurvey && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="text-4xl">??/span>
                    <p className="text-white font-bold">08:48???ㅻЦ???쒖옉?쇱슂</p>
                    <p className="text-sm text-gray-400">?뚮┝??諛쏆쑝硫?諛붾줈 李몄뿬?섏꽭??/p>
                  </div>
                )}

                {isHoliday && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="text-4xl">?룚截?/span>
                    <p className="text-white font-bold">?ㅻ뒛? ?μ씠 ?대━吏 ?딆븘??/p>
                    <p className="text-sm text-gray-400">二쇰쭚쨌怨듯쑕?쇱뿏 ?ㅻЦ??諛쒖넚?섏? ?딆뒿?덈떎</p>
                  </div>
                )}
              </>
            );
          })()}

          {(status === "open" || status === "closed" || status === "result") && today && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 text-right">
                珥?<span className="text-white font-bold">{today.total_responses}紐?/span> 李몄뿬
              </p>

              {/* 1. ?ㅼ쟻 ?쒖떆 */}
              <div className="flex gap-3">
                <div className="flex-1 bg-[#111] rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">?ㅼ쟻</p>
                  {today.kospi_result !== null && today.kospi_change_pct !== null ? (
                    <>
                      <p className={`text-2xl font-black ${today.kospi_result ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_result ? "?뱢 ?곸듅" : "?뱣 ?섎씫"}
                      </p>
                      <p className={`text-xs mt-1 ${today.kospi_change_pct >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
                        {today.kospi_change_pct >= 0 ? "+" : ""}{today.kospi_change_pct.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-black text-gray-500">?λ쭏媛먯쟾</p>
                  )}
                </div>
              </div>

              {/* 2. ?⑥닚 吏묎퀎 */}
              <div className="space-y-3">
                <p className="text-xs text-gray-500">?뱤 ?⑥닚 吏묎퀎</p>
                <SentimentBar label="肄붿뒪?? pct={today.kospi_yes_pct} />
              </div>

              {/* 3. 怨좎닔 媛以묒삁痢?*/}
              {today.kospi_weighted_pct !== null && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 space-y-3">
                  <p className="text-xs text-yellow-400 font-bold">狩?怨좎닔 媛以묒삁痢?(?꾩쟻 ?뺥솗??諛섏쁺)</p>
                  <SentimentBar label="肄붿뒪?? pct={today.kospi_weighted_pct} />
                  <p className="text-xs text-gray-600">?뺥솗???믪? ?좎????덉륫?????믪? 媛以묒튂瑜?遺?ы빀?덈떎</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ?? 移댁슫?몃떎???????????????????????????????????????? */}
        <FlipClock />

        {/* ?? 怨좎닔 vs ?섏닔 ?덉륫 ?????????????????????????????? */}
        {(today?.top_predictor || today?.worst_predictor) && (
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <p className="font-bold text-sm mb-4">?ㅻ뒛???덉륫</p>
            <div className="grid grid-cols-2 gap-3">
              {/* 怨좎닔 */}
              {today.top_predictor && (
                <div className="bg-[#111] border border-yellow-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">?몣</span>
                    <span className="text-xs text-yellow-400 font-bold">留욎땄 怨좎닔</span>
                    <span className="text-xs text-gray-600 ml-auto">{today.top_predictor.accuracy}% 쨌 {today.top_predictor.total_predictions}??/span>
                  </div>
                  <p className="text-white font-bold text-sm">{today.top_predictor.masked_name}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">肄붿뒪??/span>
                      <span className={`text-xs font-bold ${today.top_predictor.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                        {today.top_predictor.kospi_answer ? "?뱢 ?ㅻⅨ?? : "?뱣 ?대┛??}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* ?섏닔 */}
              {today.worst_predictor && (
                <div className="bg-[#111] border border-blue-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">?ㄱ</span>
                    <span className="text-xs text-blue-400 font-bold">紐삳쭪異?怨좎닔</span>
                    <span className="text-xs text-gray-600 ml-auto">{today.worst_predictor.accuracy}% 쨌 {today.worst_predictor.total_predictions}??/span>
                  </div>
                  <p className="text-white font-bold text-sm">{today.worst_predictor.masked_name}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">肄붿뒪??/span>
                      <span className={`text-xs font-bold ${today.worst_predictor.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                        {today.worst_predictor.kospi_answer ? "?뱢 ?ㅻⅨ?? : "?뱣 ?대┛??}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 text-center mt-3">紐삳쭪異?怨좎닔 ?덉륫? 諛섎? ?좏샇濡??쒖슜?섏꽭???삈</p>
            <p className="text-xs text-gray-700 text-center mt-1">?숇쪧?????덉륫 ?잛닔媛 留롮? ?щ엺???곗꽑?쇱슂</p>
          </div>
        )}

        {/* ?? ???듦퀎 ???????????????????????????????????????? */}
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
          <p className="font-bold text-sm mb-4">???듦퀎</p>

          {/* ?ㅻ뒛 ???좏깮 */}
          {dash && dash.history.length > 0 && dash.history[0].date === today?.survey_date && (
            <div className="mb-4 pb-4 border-b border-[#2A2A2A]">
              <p className="text-xs text-gray-500 mb-2">?ㅻ뒛 ???덉륫</p>
              <div className="bg-[#111] rounded-xl p-2.5 text-center w-full">
                <p className="text-xs text-gray-500 mb-0.5">肄붿뒪??/p>
                <p className={`font-bold text-sm ${dash.history[0].kospi_answer ? "text-green-400" : "text-red-400"}`}>
                  {dash.history[0].kospi_answer ? "?뱢 ?ㅻⅨ?? : "?뱣 ?대┛??}
                </p>
              </div>
            </div>
          )}

          {dash && dash.total_predictions === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-3xl">?벊</p>
              <p className="text-sm text-gray-400">
                ?꾩쭅 ?덉륫 ?대젰???놁뼱??<br />
                ?ㅻЦ???묐떟?대낫?몄슂!
              </p>
            </div>
          ) : dash ? (
            <div className="space-y-4">
              {/* ?꾩껜 ?뺥솗??+ ?쒖쐞 + 湲곗뿬??*/}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">?꾩껜 ?뺥솗??/p>
                  <p className="text-2xl font-black text-blue-400">
                    {dash.accuracy.overall !== null ? `${dash.accuracy.overall}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{dash.total_predictions}??/p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">???쒖쐞</p>
                  <p className="text-2xl font-black text-yellow-400">
                    {dash.percentile !== null ? `?곸쐞 ${dash.percentile}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">?꾩껜 ?鍮?/p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">媛以?湲곗뿬??/p>
                  <p className={`text-2xl font-black ${
                    dash.contribution !== null
                      ? dash.contribution >= 100 ? "text-green-400" : "text-orange-400"
                      : "text-gray-500"
                  }`}>
                    {dash.contribution !== null ? `${dash.contribution}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">?됯퇏 ?鍮?/p>
                </div>
              </div>

              {/* 肄붿뒪???뺥솗??*/}
              <div className="bg-[#111] rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">肄붿뒪???곸쨷瑜?/p>
                <p className="text-xl font-black text-green-400">
                  {dash.accuracy.kospi !== null ? `${dash.accuracy.kospi}%` : "-"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ?? ?덉륫 ?대젰 ?????????????????????????????????????? */}
        {dash && dash.history.length > 0 && (
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <p className="font-bold text-sm mb-3">
              理쒓렐 ?덉륫 ?대젰
              <span className="text-gray-500 text-xs font-normal ml-2">
                ??留욎쓬 / ???由?              </span>
            </p>
            <div className="space-y-2">
              {dash.history.map((item) => (
                <HistoryRow key={item.date} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>

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
          <button className="flex-1 flex flex-col items-center py-3 gap-1 text-blue-400">
            <span className="text-xl">?뱤</span>
            <span className="text-xs font-bold">??쒕낫??/span>
          </button>
          <button
            onClick={() => router.push("/setup")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">?숋툘</span>
            <span className="text-xs font-medium">?ㅼ젙</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
