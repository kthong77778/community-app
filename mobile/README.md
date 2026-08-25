# 커뮤니티 모바일 앱

[Expo](https://expo.dev/) / React Native로 만든 커뮤니티 앱(iOS · Android)입니다.
루트의 Next.js 백엔드(`../`)를 REST API로 사용합니다.

## 기능

- 회원가입 / 로그인 (Bearer 토큰, `expo-secure-store`에 안전 저장)
- 게시글 작성 / 목록 / 상세 / 삭제(작성자 본인)
- 댓글 작성 / 삭제(작성자 본인)
- 좋아요 토글

## 기술 스택

- Expo SDK 57 · React Native 0.86 · React 19
- [expo-router](https://docs.expo.dev/router/introduction/) (파일 기반 라우팅)
- TypeScript

## 사전 준비: 백엔드 실행

모바일 앱은 백엔드 API가 떠 있어야 동작합니다. 프로젝트 루트에서:

```bash
cd ..
npm install
npm run dev        # http://localhost:3000 (LAN의 0.0.0.0 로도 접근 가능)
```

## 앱 실행

```bash
npm install
npm start          # Expo 개발 서버 (QR 코드)
# 또는
npm run android
npm run ios
```

Expo Go 앱(또는 시뮬레이터/에뮬레이터)으로 QR 코드를 스캔하면 실행됩니다.

## API 주소 설정 (중요)

앱이 바라볼 백엔드 주소는 `EXPO_PUBLIC_API_URL` 환경 변수로 지정합니다.
`.env.example`를 복사해 값을 채우세요.

```bash
cp .env.example .env.local        # .env.local 은 Git에 커밋되지 않음
# .env.local 안에서 아래처럼 설정 (실제 기기는 PC의 LAN IP 사용)
#   EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
npm start

# 또는 한 번만 실행할 때는 인라인으로:
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 npm start
```

**배포(프로덕션) 빌드**에서는 자동 추정이 동작하지 않으므로 반드시 공개 HTTPS
주소를 지정해야 합니다 (`EXPO_PUBLIC_API_URL=https://api.your-domain.com`).

설정하지 않으면 **개발 모드에서만** 다음 순서로 자동 추정합니다 (`src/api/config.ts`):

1. Expo 개발 서버 호스트에서 PC의 IP를 추출 → `http://<그 IP>:3000`
2. Android 에뮬레이터 → `http://10.0.2.2:3000`
3. 그 외 → `http://localhost:3000`

> ⚠️ 실제 기기에서 `localhost`는 **폰 자신**을 가리킵니다. 반드시 PC의 LAN
> IP를 쓰거나 `EXPO_PUBLIC_API_URL`을 지정하세요. 또한 백엔드가 `localhost`가
> 아닌 `0.0.0.0`에 바인딩되어 있어야 폰에서 접근할 수 있습니다
> (`npm run dev`는 기본적으로 LAN 접근을 허용합니다).

## 프로젝트 구조

```
mobile/
├── app/                     # expo-router 화면
│   ├── _layout.tsx          # 루트 레이아웃 (Providers + Stack)
│   ├── index.tsx            # 진입 → 피드로 리다이렉트
│   ├── feed.tsx             # 게시글 목록 (홈)
│   ├── post/[id].tsx        # 게시글 상세 (좋아요·댓글)
│   ├── new.tsx              # 글쓰기
│   ├── login.tsx · register.tsx
└── src/
    ├── api/                 # config(주소) · client(fetch+토큰) · types
    ├── auth/AuthContext.tsx # 세션(토큰) 상태 + SecureStore 저장
    ├── lib/format.ts        # 상대 시간 표기
    └── theme.ts             # 색상
```

## 빌드 (앱스토어 배포)

실제 기기 빌드/스토어 제출은 [EAS Build](https://docs.expo.dev/build/introduction/)를
사용합니다.

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

배포 시에는 백엔드가 공개 도메인(HTTPS)에 배포되어 있어야 하며,
`EXPO_PUBLIC_API_URL`을 그 주소로 설정해 빌드하세요.
