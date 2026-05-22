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

# Környezeti változók
cp .env.example .env.local
# Töltsd ki: DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET

# Adatbázis migráció
pnpm db:migrate

# Fejlesztői szerverek (web + api egyszerre)
pnpm dev
# web → http://localhost:3000
# api → http://localhost:3001
```

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
| CI | Lint + type-check + test minden PR-on |

## Linkek

- [Jira Backlog](https://gebatsi.atlassian.net/jira/software/projects/KAI/boards)
- [Confluence Dokumentáció](https://gebatsi.atlassian.net/wiki/spaces/BT4th/pages/120553478)
- [GitHub Repository](https://github.com/GeBatsi/kajai)
