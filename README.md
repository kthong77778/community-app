# 커뮤니티 앱 (Community App)

게시글, 댓글, 좋아요, 회원가입/로그인 기능을 제공하는 커뮤니티 앱입니다.
하나의 백엔드를 **웹**과 **모바일 앱**이 함께 사용합니다.

- **`/`** — Next.js(App Router) 백엔드 + 웹 UI. REST API 제공.
- **`/mobile`** — Expo/React Native 모바일 앱 (iOS · Android). 위 API를 사용.

> 모바일 앱 실행/설정은 [`mobile/README.md`](./mobile/README.md)를 참고하세요.
> 아래 내용은 Next.js 백엔드(및 웹)에 대한 설명입니다.

## 기능

- **회원가입 / 로그인** — 세션 쿠키 기반 인증 (비밀번호는 scrypt로 해싱)
- **게시글** — 작성 / 목록 / 상세 보기 / 삭제(작성자 본인)
- **댓글** — 작성 / 삭제(작성자 본인)
- **좋아요** — 게시글별 좋아요 토글

## 기술 스택

- [Next.js 15](https://nextjs.org/) (App Router) + React 19
- TypeScript
- 저장소: SQLite(`better-sqlite3`). 비밀번호 해싱은 Node.js 내장 `crypto`(scrypt)

## 인증 방식 (웹 + 모바일)

- **웹**: httpOnly 세션 쿠키
- **모바일**: `Authorization: Bearer <token>` 헤더 (네이티브 앱은 쿠키를 다루기
  어려우므로 토큰 방식 사용)

로그인·회원가입 API는 응답 본문에 `token`을 함께 반환하고, 동시에 세션 쿠키도
설정합니다. 토큰은 서버 DB(`sessions` 테이블)에 저장되는 불투명 랜덤 값이라
**로그아웃 시 즉시 무효화**됩니다. 백엔드(`src/lib/auth.ts`)는 두 방식을 모두
인식하며, 로그인·회원가입에는 **rate limiting**(`src/lib/rateLimit.ts`)이
적용됩니다. `/api/*` 경로에는 CORS 헤더가 적용되어(`src/middleware.ts`) 다른
오리진에서도 호출할 수 있습니다.

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

## 테스트

```bash
npm test        # 저장소 단위 테스트 (node:test + in-memory SQLite)
```

## 환경 변수

| 변수          | 설명                                                            |
| ------------- | --------------------------------------------------------------- |
| `SQLITE_PATH` | SQLite DB 파일 경로. 기본값 `data/community.db`.                |

세션은 서버 측 DB에 저장되는 **불투명 랜덤 토큰**이라 서명용 시크릿이 필요 없고,
로그아웃 시 서버에서 즉시 무효화됩니다.

## 데이터 저장

**SQLite**(`data/community.db`, `better-sqlite3`)에 저장합니다. 트랜잭션과
정규화된 테이블(users·sessions·posts·likes·comments)을 사용하며, 좋아요/댓글
수는 SQL로 집계합니다. 설정 없이 바로 실행할 수 있고, 데이터는 재시작 후에도
유지됩니다. (DB 파일은 `.gitignore`로 제외됩니다.)

- ✅ **영속 디스크가 있는 호스트**(Railway·Render·Fly·VM·Docker)에 그대로 배포
  가능합니다.
- ⚠️ **서버리스**(예: Vercel)는 파일시스템이 임시/읽기전용이라 SQLite 파일이
  유지되지 않습니다. 이 경우 아래 방법으로 **매니지드 Postgres**를 쓰세요.

### 다른 DB(예: Postgres)로 전환하기

저장 로직은 전부 `src/lib/store/Store.ts`의 `Store` 인터페이스 뒤에 있습니다.

1. `Store`를 구현하는 클래스를 작성합니다.
   예: `src/lib/store/postgres-store.ts`의 `PostgresStore`.
2. `src/lib/store/index.ts`에서 `new SqliteStore(...)` 대신 새 구현체를
   생성하도록 한 줄만 바꿉니다(예: `DATABASE_URL` 유무로 분기).

라우트/컴포넌트 코드는 `getStore()`만 사용하므로 **다른 코드는 수정할 필요가
없습니다.** 저장소 테스트(`test/store.test.ts`)를 새 구현체로도 재사용하면
동작을 그대로 검증할 수 있습니다.

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
├── middleware.ts            # /api/* CORS
└── lib/
    ├── store/               # 저장소 추상화 (Store 인터페이스 + SQLite 구현)
    ├── auth.ts              # 세션(불투명 토큰)/비밀번호 헬퍼
    ├── rateLimit.ts         # 로그인/회원가입 rate limiting
    └── validation.ts        # 입력 검증

test/
└── store.test.ts            # 저장소 단위 테스트
```
