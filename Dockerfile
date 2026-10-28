# One image, two processes: the website (`pnpm start`) and the job worker (`pnpm worker`). DigitalOcean runs it twice
# with a different command; docker-compose.yml shows the pair. pg-boss needs Node 22.12 or later.
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# The build reads no secrets; these placeholders only satisfy the env check at build time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret-xx" \
    BETTER_AUTH_URL="http://localhost:3000" \
    CRON_SECRET="build-time-placeholder-not-a-secret" \
    pnpm build

FROM base AS runtime
ENV NODE_ENV=production JOBS_MODE=queue
# The worker runs TypeScript through tsx, so the full node_modules (with dev tools) stays in the image.
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
