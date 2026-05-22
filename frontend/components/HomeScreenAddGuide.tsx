"use client";

type Props = {
  isIOS: boolean;
  isStandalone: boolean;
  isInApp: boolean;
  /** true면 접힌 한 줄 요약만 (중복 방지용) */
  compact?: boolean;
};

/** 홈 화면(PWA) 추가 안내 — iPhone 알림·단톡에 필요. 이미 홈 화면 앱이면 숨김 */
export default function HomeScreenAddGuide({
  isIOS,
  isStandalone,
  isInApp,
  compact = false,
}: Props) {
  if (isStandalone || isInApp) {
    return null;
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    alert("주소가 복사됐어요!\nSafari 주소창에 붙여넣기 → 홈 화면에 추가해 주세요.");
  };

  const onAndroidInstall = async () => {
    const p = (window as Window & { __pwaInstallPrompt?: { prompt(): Promise<void> } })
      .__pwaInstallPrompt;
    if (p) {
      await p.prompt();
      delete (window as Window & { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt;
    } else {
      alert(
        "Chrome 주소창 오른쪽 ⋮ 메뉴를 탭한 뒤\n「앱 설치」 또는 「홈 화면에 추가」를 선택해 주세요.",
      );
    }
  };

  if (!isIOS) {
    if (compact) return null;
    return (
      <details className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span className="font-bold text-sm text-white">📲 홈 화면에 추가 (선택)</span>
          <span className="text-[10px] text-gray-500">앱처럼 실행 · 알림 안정</span>
        </summary>
        <div className="px-4 pb-4 border-t border-[#2A2A2A]">
          <p className="text-xs text-gray-400 mt-3 mb-3">
            Android·PC에서는 Chrome 메뉴에서 설치하면 바로가기처럼 쓸 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => void onAndroidInstall()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl active:scale-95 transition-all"
          >
            앱 설치 / 홈 화면에 추가
          </button>
        </div>
      </details>
    );
  }

  if (compact) {
    return (
      <p className="text-[11px] text-orange-400/90 leading-relaxed">
        iPhone: Safari <span className="text-white font-bold">공유 → 홈 화면에 추가</span> 후, 홈 화면
        아이콘으로 다시 열어 주세요. (설정 상단 📲 안내)
      </p>
    );
  }

  return (
    <details
      className="mb-6 rounded-2xl border border-orange-500/40 bg-[#1A1A1A] overflow-hidden"
      open
    >
      <summary className="cursor-pointer list-none bg-orange-500/20 px-4 py-3 flex items-center gap-2 border-b border-orange-500/20 [&::-webkit-details-marker]:hidden">
        <span className="text-lg">🍎</span>
        <div className="flex-1 min-w-0">
          <p className="font-black text-orange-300 text-sm">홈 화면에 추가 (iPhone)</p>
          <p className="text-[11px] text-orange-400/80">
            Safari 탭만 쓰면 단톡·브라우저 알림이 안 올 수 있어요 · 텔레그램만 써도 OK
          </p>
        </div>
        <span className="text-[10px] text-orange-300 shrink-0">접기</span>
      </summary>

      <div className="p-4 space-y-4 text-xs">
        <p className="text-gray-400 leading-relaxed">
          <span className="text-white font-bold">모든 iPhone 유저</span>에게 이 안내가 보입니다(이미 홈
          화면 앱으로 열면 숨겨져요). 카카오·인스타 안에서는 Safari로 먼저 열어 주세요.
        </p>

        <ol className="space-y-3 list-none">
          <li className="flex gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded h-fit">
              1
            </span>
            <span className="text-white font-bold">Safari 하단 가운데 공유(↑) 탭</span>
          </li>
          <li className="flex gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded h-fit">
              2
            </span>
            <span>
              <span className="text-white font-bold">홈 화면에 추가</span> 선택 → 우측 상단{" "}
              <span className="text-orange-300 font-bold">추가</span>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded h-fit">
              3
            </span>
            <span>
              홈 화면 <span className="text-white font-bold">코스피 예측</span> 아이콘으로 다시 접속
              (주소창 없는 전체 화면)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded h-fit">
              4
            </span>
            <span>
              그다음 <span className="text-white font-bold">브라우저 알림 허용</span> · iPhone 설정 →
              알림 → 코스피 예측 ON
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={copyUrl}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-xl text-sm active:scale-95 transition-all"
        >
          이 페이지 주소 복사하기
        </button>
      </div>
    </details>
  );
}
