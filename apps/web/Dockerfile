# KajAI web (Next.js) – a monorepo gyökeréből buildelendő:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4001 .

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# A pnpm verziót a package.json packageManager mezője adja; itt egyszer letöltjük.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ARG NEXT_PUBLIC_APPLE_ENABLED=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APPLE_ENABLED=$NEXT_PUBLIC_APPLE_ENABLED \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile --filter @kajai/web... --filter @kajai/db
RUN pnpm --filter @kajai/db generate \
  && pnpm --filter @kajai/db build \
  && pnpm --filter @kajai/web build

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo /repo
EXPOSE 4000
CMD ["pnpm", "--filter", "@kajai/web", "exec", "next", "start", "-p", "4000"]
