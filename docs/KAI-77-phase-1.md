# KAI-77 – Admin Dashboard RBAC, 1. fázis

## Kiinduló állapot

- Repository: `GeBatsi/kajai`.
- Branch: `feature/KAI-77-moderator-dashboard`.
- HEAD: `c75002049f7a91891e2d033fb9b5c5f78dcdbfe5`.
- A fejlesztés előtt a working tree tiszta volt, a kért kiindulástól nem volt eltérés.
- Nem készült új branch, commit, merge vagy push. A módosítások review-ra a working tree-ben maradnak.
- Nem futott adatbázis-reset vagy adatbázist módosító migrációs parancs.

## Módosított és új fájlok

| Fájl | Változás |
| --- | --- |
| `apps/api/src/auth/decorators/public.decorator.ts` | Új: explicit publikus végpontjelölés. |
| `apps/api/src/auth/decorators/min-role.decorator.ts` | Új: típusbiztos minimum szerepkör. |
| `apps/api/src/auth/role-hierarchy.ts` | Új: központi szerepkör-rangsor, GUEST kizárása. |
| `apps/api/src/auth/guards/nextauth.guard.ts` | Public metadata, kérésenkénti tiltásellenőrzés, GUEST elutasítása. |
| `apps/api/src/auth/guards/role.guard.ts` | Minimumszerepkör támogatása a pontos szerepkörlista megtartásával. |
| `apps/api/src/auth/auth.module.ts` | Auth és role guard globális regisztrációja, ebben a sorrendben. |
| `apps/api/src/auth/auth.controller.ts` | Publikus auth műveletek explicit jelölése, lokális auth guard eltávolítása, Response típusimport. |
| `apps/api/src/auth/auth.service.ts` | Tiltott credentials login elutasítása, belső update típus, érzékeny debug naplózás eltávolítása. |
| `apps/api/src/users/users.controller.ts` | Mind az öt CRUD végpont ADMIN-only; külön admin create/update hívás; profilútvonalak megtartása. |
| `apps/api/src/users/users.service.ts` | Explicit válaszmezők, admin jelszóhash-elés és mezőlistás admin update; belső auth update megőrzése. |
| `apps/api/src/users/dto/update-user.dto.ts` | Csak opcionális name/image szerkeszthető. |
| `apps/api/src/foods/foods.controller.ts` | Publikus olvasások és minimum MODERATOR védelem; lokális guardok eltávolítása. |
| `apps/api/src/ingredients/ingredients.controller.ts` | Publikus olvasások; globális guardokra átállás. |
| `apps/api/src/stores/stores.controller.ts` | Publikus olvasások; globális guardokra átállás. |
| `apps/api/src/product-availability/product-availability.controller.ts` | Publikus olvasások; globális guardokra átállás. |
| `apps/api/src/health/health.controller.ts` | Publikus health check. |
| `packages/db/prisma/schema.prisma` | User.bannedAt és User.banReason nullable mezők. |
| `packages/db/prisma/migrations/20261118120000_add_user_ban_fields/migration.sql` | Új, kizárólag additív ALTER TABLE. |
| `apps/web/src/lib/auth.ts` | Tiltásellenőrzés belépéskor és session-frissítéskor. |
| `apps/web/src/types/next-auth.d.ts` | Session.user.isBanned jelölés. |
| `apps/api/src/auth/guards/nextauth.guard.spec.ts` | Új guardfüggőség és adatbázis select ellenőrzése; korábbi biztonsági esetek megtartása. |
| `apps/api/src/auth/session-auth.integration.spec.ts` | Globális guardok HTTP-regressziói, minden publikus olvasás ellenőrzése hibás cookie-val is. |
| `apps/api/src/auth/rbac.integration.spec.ts` | Új: szerepkörmátrix, Users, tiltás és auth regressziók valódi Nest HTTP-alkalmazással. |
| `apps/api/package.json` | Az új node:test suite bekötése a test:auth és így a teljes test parancsba. |
| `apps/web/scripts/test-food-access.cjs` | Tiltásmezős tesztadatok, tiltott admin UI- és oldalelérésének regressziója. |
| `apps/web/scripts/test-session-refresh.cjs` | Tiltás, törölt user, credentials/verification/Google/Apple callbackek regressziói. |
| `apps/api/src/auth/README.md` | Globális guard, szerepkörök, publikus útvonalak, tiltás és migráció dokumentálása. |
| `docs/KAI-77-phase-1.md` | Ez az implementációs és ellenőrzési jegyzőkönyv. |

Az `AppModule`, a Prisma korábbi migrációi, az AuditService és az audit adattábla
változatlanok. A globális guardok az AppModule által már importált AuthModule-ban
kapnak regisztrációt; nem szükséges új modulkapcsolat vagy körkörös függőség.

## Jogosultságok és válaszadatok

Az `ADMIN > MODERATOR > USER` sorrendet egy `Record<Role, number>` követelménnyel
ellenőrzött központi rangsor kezeli. A `@MinRole` csak regisztrált szerepkört
fogad; GUEST nem kap felhasználói jogosultságot. A globális auth guard a GUEST
felhasználót a védett végpontokról kizárja.

A `@Roles` továbbra is pontos listát ellenőriz: például `@Roles('USER')` nem
enged be ADMINT. Ha `@Roles` és `@MinRole` együtt szerepel, mindkettőnek
teljesülnie kell. Azonos metadata esetén a metódusszint elsőbbséget élvez az
osztályszinttel szemben. A food műveletek `@MinRole(Role.MODERATOR)` használatával
ugyanazt az ADMIN/MODERATOR hozzáférést őrzik meg.

Az AuthModule `APP_GUARD` providerei `useExisting` kapcsolással a már létrehozott
NextAuthGuard és RolesGuard példányt használják. A controllerenkénti lokális
guardok megszűntek. A teszt ellenőrzi, hogy egy védett Users kérés pontosan
egyszer kérdezi le az autentikáló user rekordot.

| Útvonal | Hozzáférés |
| --- | --- |
| GET/POST `/api/users` | ADMIN |
| GET/PATCH/DELETE `/api/users/:id` | ADMIN |
| GET/PATCH `/api/users/me/profile` | Minden nem tiltott USER/MODERATOR/ADMIN |
| POST `/api/users/me/profile/preview` | Minden nem tiltott USER/MODERATOR/ADMIN |
| GET `/api/auth/me` | Minden nem tiltott USER/MODERATOR/ADMIN |
| Food módosítások, history, restore, image műveletek | Minimum MODERATOR |
| Ingredients, stores, product availability módosítások | ADMIN |

A User CRUD válaszok explicit Prisma selectje: id, email, name, image, role,
isVerified, createdAt, updatedAt. Jelszóhash, belépési token és tiltási indok
nem kerül ezekbe a válaszokba. A DELETE és admin PATCH válasza is ezt a selectet
használja. Az auth belső findByEmail lekérdezése megtartja a bcrypt-ellenőrzéshez
szükséges hash-t.

Az admin PATCH DTO csak name/image mezőt enged, a globális ValidationPipe minden
további mezőt 400-zal elutasít. Az updateAdmin service külön is explicit
mezőlistát ír, így validation pipe nélkül sem történik tömeges mezőhozzárendelés.
Az InternalUserUpdate és a belső update metódus továbbra is engedi az auth által
előállított jelszóhash és isVerified frissítését.

Az admin create a kapott jelszót bcrypt 12 költséggel hash-eli. A regisztráció
korábban is hash-elt jelszót adott a belső create-nak; ez megmaradt, dupla
hash-elés nélkül. A jelszó nélküli admin létrehozás szintén támogatott.

## Nyilvános végpontok

- POST `/api/auth/register`, `/api/auth/login`, `/api/auth/forgotpassword`, `/api/auth/resetpassword`.
- GET `/api/auth/verify`.
- POST `/api/auth/logout`, a korábbi cookie-törlési működéssel.
- GET `/api/foods`, `/api/foods/:id`.
- GET `/api/ingredients`, `/api/ingredients/:id`, `/api/ingredients/food/:foodItemId`.
- GET `/api/stores`, `/api/stores/:id`.
- GET `/api/product-availability`, `/api/product-availability/:id`.
- GET `/api/health`.

A jelölések metódusszintűek: az ugyanarra a controllerre később felvett
végpontok nem öröklik automatikusan a nyilvánosságot. A food history védett maradt.

## Tiltás és NextAuth-kompatibilitás

A guard a valódi NextAuth v4 titkosított, akár darabolt kajai-session cookie-t
ellenőrzi, továbbra is kizárólag a hiteles userId-t használva a tokenből. Az
aktuális szerepkört és bannedAt állapotot minden védett kérésnél adatbázisból
olvassa. A token role és a kliens role fejléce nem használható jogemelésre.
A módosító védett kérések Origin-ellenőrzése változatlan.

- Hiányzó/hibás/lejárt session vagy törölt user: 401.
- Érvényes session, de tiltott user, GUEST vagy elégtelen szerepkör: 403.
- Credentials login tiltott userrel: 401.
- A NextAuth signIn callbackje a credentials, email-verification és OAuth
  folyamatokat is ellenőrzi; az induló jwt callback az upsert után ismét ellenőriz.
- Új OAuth user továbbra is létrehozható. A tiltott user nem jut el használható
  új sessionig; egy időközben felvett tiltást az API minden esetben érvényesít.
- A session callback az adatbázist újraolvassa, tiltáskor üres id, GUEST role és
  isBanned: true kerül a frontend sessionbe. Törölt usernél szintén nincs
  használható azonosító/jogosultság. A cookie megléte önmagában nem jelent hozzáférést.

Nem készült új JWT-hitelesítés. A korábbi email-verifikációs válasz legacy tokenje
megmaradt a kompatibilitás miatt; a session guard ezt továbbra sem fogadja el.

## Prisma-migráció és ellenőrzés

A `20261118120000_add_user_ban_fields` migráció a users táblához `bannedAt
TIMESTAMP(3)` és `banReason TEXT` nullable oszlopot ad. A meglévő sorokban mindkettő
NULL; nincs backfill, törlés, enumátalakítás vagy auditmódosítás.

A meglévő migrációkat áttekintettem, nem módosítottam. A Prisma validate sikeres,
a kliens újragenerálása sikeres. A kiinduló commit sémája és az új séma közötti
`prisma migrate diff --script` kizárólag e két oszlop hozzáadását eredményezte,
ami tartalmilag egyezik az új SQL-migrációval.

Adatbázison migrációalkalmazás vagy teljes migrációs replay nem történt.
A PostgreSQL-integrációhoz szükséges FOOD_TEST_DATABASE_URL nem állt rendelkezésre.
Telepítés előtt az új migrációt a repository szokásos migrate:deploy folyamatával
alkalmazni kell, majd a generált klienssel együtt telepíteni az API-t és a webet.

## Tesztek és eredmények

| Ellenőrzés | Eredmény |
| --- | --- |
| `pnpm --filter @kajai/api type-check` | Sikeres. |
| `pnpm --filter @kajai/api test` | Sikeres: 42 Jest + 352 food + 189 auth/RBAC teszt; 1 meglévő PostgreSQL food teszt kihagyva. |
| `pnpm --filter @kajai/web type-check` | Sikeres. |
| `pnpm --filter @kajai/web test` | Mind a négy meglévő tesztprogram sikeres az új regressziókkal együtt. |
| `pnpm --filter @kajai/api lint` | Sikeres. |
| `pnpm --filter @kajai/web lint` | Sikeres, nincs ESLint warning vagy error; a Next CLI külön deprecációs tájékoztatást ad a next lint jövőbeli megszűnéséről. |
| `pnpm --filter @kajai/db prisma:validate` | Sikeres. |
| `pnpm --filter @kajai/db generate` | Sikeres, Prisma Client 5.22.0. |
| Prisma schema diff | Csak a két nullable oszlop hozzáadása. |
| `git diff --check` | Sikeres. |

A node:test alapú új backend teszt a meglévő test:auth futtatóba került.
A Jest testPathIgnorePatterns listája ezért ugyanúgy kezeli, mint a korábbi
node:test suite-okat; a teljes pnpm test ténylegesen lefuttatja. Meglévő tesztet
nem tiltottam le, nem töröltem és nem gyengítettem.

A pnpm a sandboxban `unable to open database file` hibát adott. A szükséges
parancsok engedélykéréssel, sandboxon kívül futottak sikeresen. Ez a pnpm
környezeti hozzáférési problémája volt, nem a projekt PostgreSQL adatbázisának hibája.

Az új HTTP-s tesztek valódi Nest routingot, globális guardokat, cookie parsert,
ValidationPipe-ot, controller- és service-kódot futtatnak. Csak az adatbázis és
email I/O helyettesített. Lefedik a szerepkörmátrixot, öröklést, pontos role-listát,
401/403 különbséget, hamis role-t, kérésenként egyszeri hitelesítést, minden Users CRUD
végpontot, tiltott PATCH mezőket, hash nélküli válaszokat, admin jelszókezelést,
sajátprofilt és a teljes regisztráció/verifikáció/login/password-reset folyamatot.
A frontend teszt a telepített NextAuth core session handlerével is futtat
frissítést, továbbá a valódi callbackeket teszteli minden belépési módra.

## Fennmaradó feladatok és 2. fázis

- Az új migráció adatbázisos kipróbálása és a meglévő PostgreSQL-teszt futtatása
  elkülönített tesztadatbázison még szükséges.
- A korábban már kihagyott, többnyire csak DI-létezést vizsgáló Jest scaffold
  tesztek jelenlegi futtatási konfigurációja változatlan; ezek rendbetétele külön technikai adósság.
- A meglévő email-verifikáció/password-reset tokenkezelés nem mindenhol ellenőrzi
  a token célját; a verifikáció lejáratellenőrzése és az egyszer használatos token
  fogyasztás/frissítés atomikussága külön biztonsági felülvizsgálatot igényel.
  Ezeket a meglévő auth folyamatok üzleti logikáját most nem írtam át.
- A backend logout korábbi cookie-törlése megmaradt; a darabolt session-cookie-k
  teljes törlésének felülvizsgálata külön feladat.
- A belső create továbbra is előre hash-elt jelszót vár. Új HTTP-hívási pont
  csak a hash-elő createAdmin metódust használja; ezt a belső szerződést őrizni kell.
- A DELETE végpont végleges üzleti szabályai, cascade ellenőrzése és új auditja
  a későbbi fázis része, a kérésnek megfelelően.
- A 2. fázis előtt alkalmazni kell a migrációt, biztosítani kell az ADMIN
  tesztfelhasználót, valamint rögzíteni a role change és ban/unban tranzakciós,
  auditálási és önkizárást/utolsó admint védő szabályait.
- Admin UI, keresés/lapozás, role change és ban/unban endpoint, jóváhagyási panel
  vagy új Users CRUD API ebben a fázisban nem készült.
