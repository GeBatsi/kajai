# Deploy és környezetek

| Környezet | Mikor frissül | Web | API | Adatbázis |
| --- | --- | --- | --- | --- |
| Helyi | – | `pnpm dev` vagy `docker compose up` (4000) | 4001 | közös Neon dev DB vagy helyi Postgres (Docker) |
| Staging | minden push a `dev` ágra | Vercel (preview) | Railway | külön staging Postgres |

## CI (`.github/workflows/ci.yml`)

Minden PR-on és pushon fut:

1. **Lint · Type-check · Test · Build** – `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.
2. **Docker Compose smoke test** – felépíti és elindítja a teljes `docker-compose.yml`-t, majd
   ellenőrzi az API `/api/health` végpontját és a web `/login` oldalát.

## Staging deploy (`.github/workflows/deploy-staging.yml`)

A `dev` ágra kerülő minden változás után (vagy kézzel: Actions → Deploy staging → Run workflow):

1. `prisma migrate deploy` a staging adatbázison,
2. API → Railway (`apps/api/Dockerfile`, beállítások: `railway.json`), utána health check,
3. web → Vercel (preview környezet).

Ha egy lépéshez hiányzik a titok, a lépés **kihagyódik** (a futás összegzésében „notice" jelzi), nem bukik el.

### Egyszeri beállítás

**GitHub** → repo → Settings → Secrets and variables → Actions

| Név | Típus | Honnan |
| --- | --- | --- |
| `STAGING_DATABASE_URL` | Secret | a staging Postgres kapcsolati stringje (pl. Railway Postgres vagy külön Neon branch) |
| `RAILWAY_TOKEN` | Secret | Railway → projekt → Settings → Tokens → *Project token* (a staging környezetre) |
| `VERCEL_TOKEN` | Secret | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Secret | `vercel link` után a `.vercel/project.json` `orgId` mezője |
| `VERCEL_PROJECT_ID` | Secret | ugyanott a `projectId` mező |
| `RAILWAY_API_SERVICE` | Variable (opcionális) | a Railway service neve, alapértelmezés: `api` |
| `STAGING_API_URL` | Variable (opcionális) | az API publikus címe; ha meg van adva, deploy után health check fut |

**Railway** – új projekt, benne egy `api` nevű service ebből a repóból (a build a `railway.json` alapján
a `apps/api/Dockerfile`-t használja). Változók a service-en:

- `DATABASE_URL` (ugyanaz, mint a `STAGING_DATABASE_URL`), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (a staging web címe),
  `JWT_SECRET`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`
- `API_PORT=4001` és `PORT=4001` (a Railway ezen a porton éri el a konténert)

**Vercel** – új projekt ebből a repóból, *Root Directory*: `apps/web`, framework: Next.js.
Változók a **Preview** környezetben:

- `NEXT_PUBLIC_API_URL` (a staging API címe), `NEXTAUTH_URL` (a staging web címe), `NEXTAUTH_SECRET`
  (ugyanaz, mint az API-n), `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- A Google OAuth kliensben fel kell venni a staging redirect URI-t: `https://<staging-web>/api/auth/callback/google`

## Titkok kezelése

- Valódi kulcs **soha** nem kerül a repóba: `.env`, `.env.local` és `apps/web/.env.local` gitignorált,
  a Docker image-be sem kerülnek be (`.dockerignore`).
- Minden változó leírása: [`.env.example`](../.env.example).
- Staging/éles értékek csak GitHub Secrets-ben, Railway és Vercel változókban élnek.
