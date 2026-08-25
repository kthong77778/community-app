# 커뮤니티 앱 (Community App)

Next.js(App Router) + TypeScript로 만든 간단한 커뮤니티 앱입니다.
게시글, 댓글, 좋아요, 회원가입/로그인 기능을 제공합니다.

## 기능

- **회원가입 / 로그인** — 세션 쿠키 기반 인증 (비밀번호는 scrypt로 해싱)
- **게시글** — 작성 / 목록 / 상세 보기 / 삭제(작성자 본인)
- **댓글** — 작성 / 삭제(작성자 본인)
- **좋아요** — 게시글별 좋아요 토글

## 기술 스택

- [Next.js 15](https://nextjs.org/) (App Router) + React 19
- TypeScript
- 외부 런타임 의존성 없음 — 인증/해싱은 Node.js 내장 `crypto` 사용

## 시작하기

```bash
npm install
npm run dev
```

개발 서버가 <http://localhost:3000> 에서 실행됩니다.

프로덕션 빌드:

```bash
npm run build
npm start
```

## 환경 변수

| 변수          | 설명                                                      |
| ------------- | --------------------------------------------------------- |
| `AUTH_SECRET` | 세션 쿠키 서명용 시크릿. **운영 환경에서는 반드시 설정.** |

`.env.local` 예시:

```
AUTH_SECRET=충분히-길고-무작위한-문자열
```

## 데이터 저장

현재는 **JSON 파일**(`data/community.json`)에 저장합니다. 설정 없이 바로
실행할 수 있어 개발/데모에 적합합니다. (파일은 `.gitignore`로 제외됩니다.)

### 나중에 실제 DB로 전환하기

저장 로직은 전부 `src/lib/store/Store.ts`의 `Store` 인터페이스 뒤에 숨겨져
있습니다. DB로 옮기려면:

1. `Store` 인터페이스를 구현하는 클래스를 작성합니다.
   예: `src/lib/store/postgres-store.ts`의 `PostgresStore`.
2. `src/lib/store/index.ts`에서 `new JsonStore(...)` 대신 새 구현체를
   생성하도록 한 줄만 바꿉니다.

라우트/컴포넌트 코드는 `getStore()`만 사용하므로 **다른 코드는 수정할 필요가
없습니다.**

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                 # API 라우트 (auth, posts, comments)
│   ├── posts/[id]/          # 게시글 상세
│   ├── posts/new/           # 글쓰기
│   ├── login/ · register/   # 인증 페이지
│   ├── page.tsx             # 게시글 목록(홈)
│   └── layout.tsx
├── components/              # Header, AuthProvider
└── lib/
    ├── store/               # 저장소 추상화 (Store 인터페이스 + JSON 구현)
    ├── auth.ts              # 세션/비밀번호 헬퍼
    ├── posts.ts             # PostView 조립
    └── validation.ts        # 입력 검증
```
