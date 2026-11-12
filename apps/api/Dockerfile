# KajAI API (NestJS) – a monorepo gyökeréből buildelendő:
#   docker build -f apps/api/Dockerfile .
# Induláskor lefuttatja a Prisma migrációkat, utána indítja az API-t a 4001-es porton.

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# A pnpm verziót a package.json packageManager mezője adja; itt egyszer letöltjük.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter @kajai/api... --filter @kajai/db
RUN pnpm --filter @kajai/db generate \
  && pnpm --filter @kajai/db build \
  && pnpm --filter @kajai/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 4001
CMD ["sh", "-c", "pnpm --filter @kajai/db migrate:deploy && node apps/api/dist/main.js"]
