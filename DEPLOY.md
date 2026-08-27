# 배포 가이드 (댕냥마을)

앱의 모든 영속 로직은 `Store` 인터페이스(`src/lib/store/Store.ts`) 뒤에 있고,
`getStore()`가 환경변수로 구현체를 고른다 — 라우트/화면 코드는 바꿀 필요가 없다.

배포 후 운영 루틴(백업·모니터링·업데이트)은 `OPERATIONS.md` 참고.

## 빠른 배포 (혼자서, 관리형 호스팅)

세 가지 방법. **가장 쉬운 건 Render Blueprint(A) 또는 Railway(B).**

### A. Render (영속 디스크 + SQLite) — `render.yaml` 있음
1. https://render.com → New → **Blueprint** → 이 저장소 선택
2. `render.yaml`이 웹 서비스 + `/data` 영속 디스크(1GB) + `AUTH_SECRET` 자동생성까지 구성
3. 배포되면 `https://<이름>.onrender.com` 접속. 헬스체크는 `/api/health`
> 영속 디스크는 Render **유료 플랜** 필요. 무료로 하려면 아래 "Postgres로" 참고.

### B. Railway (Dockerfile 자동 사용)
1. https://railway.app → New Project → Deploy from GitHub → 이 저장소
2. Variables에 `AUTH_SECRET`(임의의 긴 문자열), `SQLITE_PATH=/data/community.db`,
   `UPLOAD_DIR=/data/uploads` 추가
3. Volume을 하나 만들어 `/data`에 마운트 → 재배포에도 데이터 유지
4. 도메인 생성(Settings → Networking → Generate Domain)

### C. Docker (직접 서버/VM)
```bash
docker build -t daengnyang .
docker run -d --name daengnyang -p 3000:3000 \
  -e AUTH_SECRET="충분히-긴-랜덤-값" \
  -e SQLITE_PATH=/data/community.db \
  -e UPLOAD_DIR=/data/uploads \
  -v daengnyang-data:/data \
  daengnyang
```
`-v ...:/data` 볼륨이 DB와 업로드 이미지를 영속화한다.

### Postgres로 (서버리스/무료 디스크 없이)
Neon·Supabase 등에서 무료 Postgres를 만들고 그 연결 문자열을 `DATABASE_URL`로
넣으면 자동으로 PostgresStore를 쓴다. 이땐 영속 디스크가 없어도 데이터가 남는다.
(단, 업로드 이미지는 여전히 스토리지 필요 — 아래 "이미지 업로드" 참고.)

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
