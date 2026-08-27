# 배포 가이드 (댕냥마을)

앱의 모든 영속 로직은 `Store` 인터페이스(`src/lib/store/Store.ts`) 뒤에 있고,
`getStore()`가 환경변수로 구현체를 고른다 — 라우트/화면 코드는 바꿀 필요가 없다.

## 데이터베이스 선택 (`getStore()`)

| 조건 | 사용 구현 | 용도 |
|---|---|---|
| `DATABASE_URL` 설정됨 | **PostgresStore** (`pg`) | 서버리스·다중 인스턴스 (Vercel, Neon, Supabase, RDS 등) |
| 아니면 | **SqliteStore** (`better-sqlite3`) | 로컬 개발, 영속 디스크 호스트 (Railway/Render/Fly/VM/Docker) |

두 구현은 같은 스키마·동작을 보장한다. Postgres는 SQLite의 `rowid` 정렬을
`seq BIGSERIAL` 컬럼으로 대체하고, 첫 기동 시 테이블을 생성하며 기본 장소·상품을
시드한다(빈 DB일 때만).

## 환경변수

- `DATABASE_URL` — Postgres 연결 문자열. 설정하면 Postgres 사용.
  예: `postgres://user:pass@host:5432/dbname`
- `SQLITE_PATH` — SQLite 파일 경로 (기본 `data/community.db`). 영속 디스크에
  마운트된 경로를 가리키게 한다.
- `AUTH_SECRET` — 세션 토큰 HMAC 서명 키. **프로덕션에서 반드시 강한 값으로 설정**
  (미설정 시 개발용 기본값이 쓰여 안전하지 않음).
- `UPLOAD_DIR` — 업로드 이미지 저장 경로 (기본 `public/uploads`).

## 이미지 업로드

`POST /api/upload`는 파일을 `UPLOAD_DIR`(기본 `public/uploads`)에 저장하고
`/uploads/<파일>` 경로를 돌려준다.

- **영속 디스크 호스트**: 그대로 동작 (public/uploads가 정적 서빙됨). 볼륨을
  `UPLOAD_DIR`로 마운트하면 재배포에도 사진이 남는다.
- **서버리스(Vercel 등)**: 파일시스템이 읽기 전용/휘발성이라 로컬 저장은 부적합.
  S3·Cloudflare R2 같은 오브젝트 스토리지에 올리도록 `/api/upload`를 교체하거나
  클라이언트 직접 업로드(presigned URL)로 바꾼다.

## 계정 / 인증

계정은 `src/lib/accounts.json`에 하드코딩(평문)돼 있고 세션은 무상태 HMAC 토큰이라
DB와 무관하다. 회원가입은 없다. 배포 시 `accounts.json`의 계정/비밀번호를 바꾸고
`AUTH_SECRET`을 설정한다.

## 체크리스트

1. `AUTH_SECRET` 설정
2. DB 선택: `DATABASE_URL`(Postgres) 또는 영속 디스크 + `SQLITE_PATH`
3. 이미지: 영속 디스크면 `UPLOAD_DIR` 볼륨, 서버리스면 오브젝트 스토리지 연동
4. `accounts.json` 실제 계정으로 교체
5. `npm run build` 후 `npm start`
