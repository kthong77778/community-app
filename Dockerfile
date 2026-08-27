# 댕냥마을 프로덕션 이미지 (Next.js 백엔드+웹 한 몸).
# 멀티 스테이지: 빌드 → 런타임. better-sqlite3/pg 네이티브 모듈 빌드 도구 포함.

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# node_modules는 빌드 스테이지에서 네이티브 바이너리까지 컴파일된 것을 그대로 복사.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
