import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen px-6 py-12 text-gray-300">
      <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 mb-8 block">← 돌아가기</Link>

      <h1 className="text-xl font-black text-white mb-1">개인정보처리방침</h1>
      <p className="text-xs text-gray-500 mb-8">최종 수정일: 2026년 5월 5일</p>

      <div className="space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold mb-2">1. 수집하는 개인정보 항목</h2>
          <p className="text-gray-400">소셜 로그인(Google, Kakao) 시 다음 정보를 수집합니다.</p>
          <ul className="mt-2 space-y-1 text-gray-400">
            <li>· 이름 (닉네임)</li>
            <li>· 이메일 주소</li>
            <li>· 텔레그램 연동 시: 텔레그램 채팅 ID</li>
          </ul>
          <p className="mt-2 text-gray-500 text-xs">채팅 내용, 연락처, 위치정보, 프로필 사진은 수집하지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">2. 수집 목적</h2>
          <ul className="space-y-1 text-gray-400">
            <li>· 서비스 회원 식별 및 로그인</li>
            <li>· 텔레그램 설문 발송 및 결과 알림</li>
            <li>· 예측 정확도 기록 및 순위 산정</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">3. 보유 및 이용 기간</h2>
          <p className="text-gray-400">
            회원 탈퇴 시 즉시 삭제합니다. 단, 관련 법령에 의해 보존 의무가 있는 경우 해당 기간 동안 보관합니다.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">4. 제3자 제공</h2>
          <p className="text-gray-400">
            수집한 개인정보를 외부에 제공하지 않습니다. 단, 서비스 운영을 위해 아래 플랫폼을 이용합니다.
          </p>
          <ul className="mt-2 space-y-1 text-gray-400">
            <li>· <span className="text-white">Supabase</span> — 데이터베이스 및 인증 (미국 소재)</li>
            <li>· <span className="text-white">Vercel</span> — 프론트엔드 호스팅 (미국 소재)</li>
            <li>· <span className="text-white">Railway</span> — 백엔드 서버 (미국 소재)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">5. 이용자의 권리</h2>
          <p className="text-gray-400">
            언제든지 개인정보 열람, 수정, 삭제(탈퇴)를 요청할 수 있습니다.
            탈퇴를 원하시면 아래 이메일로 문의 주세요.
          </p>
          <p className="mt-2 text-xs">
            문의:{" "}
            <a href="mailto:forsmartonly@gmail.com" className="text-blue-400 hover:underline">
              forsmartonly@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">6. 쿠키 및 자동 수집</h2>
          <p className="text-gray-400">
            로그인 세션 유지를 위해 브라우저 로컬스토리지에 인증 토큰을 저장합니다.
            별도의 광고 추적 쿠키는 사용하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">7. 방침 변경 안내</h2>
          <p className="text-gray-400">
            본 방침이 변경될 경우 서비스 내 공지를 통해 안내합니다.
          </p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t border-[#2A2A2A] text-center">
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] rounded-2xl text-sm text-gray-400 transition-all"
        >
          서비스로 돌아가기
        </Link>
      </div>
    </main>
  );
}
