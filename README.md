# KajAI

> AI-powered nutrition & fitness tracker – Magyar piacra optimalizálva

**MyFitnessPal + Yazio + recept adatbázis + AI dietetikus + árfigyelő** kombinációja.

## Stack

| Réteg | Technológia |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, REST + WebSocket |
| Adatbázis | PostgreSQL 15, Prisma ORM |
| Cache / Queue | Redis 7, BullMQ |
| Keresés | Meilisearch |
| AI | OpenAI GPT-4o, Vision |
| Tárolás | Cloudflare R2 / S3 |
| Deploy | Vercel (web) + Railway (api) |

## Gyors start

### Előfeltételek

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+
- Docker (opcionális, ajánlott)

### Telepítés

```bash
git clone https://github.com/GeBatsi/kajai.git
cd kajai

# Függőségek
pnpm install

# Környezeti változók (a részleteket ld. .env.example)
cp .env.example .env.local
cp .env.example apps/web/.env.local
cp .env.local .env   # a Prisma parancsok ezt olvassák

# Prisma kliens + adatbázis migráció
pnpm db:generate
pnpm --filter @kajai/db build
pnpm db:migrate

# Fejlesztői szerverek (web + api egyszerre)
pnpm dev
# web → http://localhost:4000
# api → http://localhost:4001/api   (health: /api/health)
```

### Docker Compose

Docker-rel a teljes stack (Postgres, Redis, Meilisearch, API, web) egy paranccsal indul:

```bash
docker compose up -d --build   # web: http://localhost:4000, api: http://localhost:4001/api
docker compose down            # leállítás (az adatok megmaradnak; -v törli őket)
```

Ha csak az adatbázis és a cache kell (az appot `pnpm dev`-vel futtatod):

```bash
docker compose up -d postgres redis
```

Ilyenkor a `.env.local`-ban: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kajai_dev"`.

### Deploy

CI, staging deploy és a szükséges titkok: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Projektstruktúra

```
kajai/
├── apps/
│   ├── web/          # Next.js frontend (App Router)
│   └── api/          # NestJS backend
├── packages/
│   ├── db/           # Prisma schema + migrations
│   ├── ui/           # Shared UI components (shadcn/ui)
│   └── types/        # Shared TypeScript types
├── docs/            # Deploy és környezetek leírása
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

## Fejlesztési folyamat

| Szabály | Leírás |
|---|---|
| Branch | `feature/KAI-XX-rövid-leírás` |
| Commit | Conventional Commits (`feat:`, `fix:`, `chore:`) |
| PR | Minden PR-hoz Jira ticket (KAI-XX) |
| Review | Min. 1 approval szükséges merge előtt |
| CI | Lint + type-check + test + build és Docker füstteszt minden PR-on |

## Linkek

- [Jira Backlog](https://gebatsi.atlassian.net/jira/software/projects/KAI/boards)
- [Confluence Dokumentáció](https://gebatsi.atlassian.net/wiki/spaces/BT4th/pages/120553478)
- [GitHub Repository](https://github.com/GeBatsi/kajai)
