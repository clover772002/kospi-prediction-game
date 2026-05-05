# 🐸 똥손인증대결

> 나보다 투자 못하는 분? — 손실이 클수록 높은 등급을 받는 역발상 투자 커뮤니티

## 프로젝트 구조

```
대대결 게임 만들기/
├── frontend/          # Next.js 프론트엔드
└── backend/           # FastAPI 백엔드
```

## 시작하기

### 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. `backend/schema.sql` 내용을 Supabase SQL Editor에서 실행
3. `Project Settings > API`에서 URL과 Service Role Key 복사

### 2. 백엔드 실행

```powershell
cd backend
.\venv\Scripts\Activate
# .env 파일 생성 (.env.example 참고)
copy .env.example .env
# .env에 실제 키 값 입력 후
uvicorn main:app --reload
```

### 3. 프론트엔드 실행

```powershell
cd frontend
# .env.local 생성 (.env.local.example 참고)
copy .env.local.example .env.local
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 등급 체계

| 등급 | 조건 | 설명 |
|------|------|------|
| 👑 심해층 | -80% 이하 | 전설의 손실러 |
| 💎 지하층 | -50% ~ -80% | 시장의 역지표 |
| 🔥 지층 | -30% ~ -50% | 추매의 달인 |
| ⚡ 지상층 | -10% ~ -30% | 성장 가능성 있는 오답자 |
| 🌱 견습생 | 0% ~ -10% | 이제 시작 |

## 기술 스택

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python
- **DB**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o Vision (수익률 OCR)
