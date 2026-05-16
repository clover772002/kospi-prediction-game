import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen px-6 py-12 text-gray-300">
      <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 mb-8 block">← 돌아가기</Link>

      <h1 className="text-xl font-black text-white mb-1">개인정보처리방침</h1>
      <p className="text-xs text-gray-500 mb-8">최종 수정일: 2026년 5월 9일</p>

      <div className="space-y-8 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold mb-2">1. 수집하는 개인정보 항목</h2>
          <p className="text-gray-400">소셜 로그인(Google, Kakao) 시 다음 정보를 수집합니다.</p>
          <ul className="mt-2 space-y-1 text-gray-400">
            <li>· 이름 (닉네임)</li>
            <li>· 이메일 주소</li>
            <li>· 텔레그램 연동 시: 텔레그램 채팅 ID</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            <span className="text-gray-400">고수 소통 기능 사용 시:</span> 참가자가 보낸 메시지 본문, 스레드
            정보, 고수 「팁 수락」 시점 등이 서비스 제공·분쟁 대응·스팸 방지를 위해 Supabase(DB)에 저장됩니다. 보낸
            직후에는 참가자 토큰만 차감되었다가 고수가 수락하면 상대에게 정산되는 흐름으로 처리합니다.
          </p>
          <p className="mt-1 text-gray-500 text-xs">프로필 사진·연락처·실시간 위치는 수집하지 않습니다.</p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">2. 수집 목적</h2>
          <ul className="space-y-1 text-gray-400">
            <li>· 서비스 회원 식별 및 로그인</li>
            <li>· 설문 발송 및 결과 알림 (알림 봇 이용)</li>
            <li>· 예측 정확도 기록 및 순위 산정</li>
            <li>· 고수 소통 메시지 전달·안내 및 부정 이용 방지</li>
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
            <li>
              · <span className="text-white">Stripe</span> — 토큰 팩 등 유료 결제 처리 (미국 소재).
              카드 결제 시 결제 정보는 Stripe 및 카드 네트워크에 따라 필요한 범위에서 처리됩니다. 당사는 원칙적으로 전체 카드 번호를 저장하지 않습니다.
            </li>
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
          <h2 className="text-white font-bold mb-2">7. 디지털 콘텐츠·토큰(플랫폼 크레딛)</h2>
          <p className="text-gray-400">
            일부 기능은 서비스 내 토큰을 사용하거나, 유료 결제로 토큰 팩을 구매하여 이용할 수 있습니다.
            토큰은 현금 또는 외환으로 환전·환급되지 않는 플랫폼 전용 크레딛이며, 아이템·집계형 콘텐츠 열람 등 서비스 범위 내에서만 소비됩니다.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            집계 및 아이템(열람형 정보)은 참고용 정보이며 특정 종목·지수 매매를 권유하거나 수익을 보장하지 않습니다 (투자 자문 아님).
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">8. 청약철회·환불(유료 이용)</h2>
          <p className="text-gray-400">
            전자상거래법 등 관련 법령에 따라 디지털 콘텐츠·즉시 사용 가능한 플랫폼 크레딧(토큰)의 성격상, 제공이 개시된 후에는 청약철회가 제한될 수 있습니다.
          </p>
          <p className="text-gray-400 mt-2">
            미사용 상태의 결제, 중복 결제, 서비스 오류 등은 이메일로 문의해 주시면 사실관계 확인 후 처리 방안을 안내합니다.
          </p>
          <p className="text-xs mt-2">
            문의:{" "}
            <a href="mailto:forsmartonly@gmail.com" className="text-blue-400 hover:underline">
              forsmartonly@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-2">9. 방침 변경 안내</h2>
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
