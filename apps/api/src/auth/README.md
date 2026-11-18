# Sessionalapú API-hitelesítés

A `NextAuthGuard` a `kajai-session` HttpOnly cookie-t ellenőrzi, beleértve
a NextAuth által több cookie-ba darabolt sessiont is. A telepített NextAuth v4
alapértelmezett titkosított tokenformátumát használja, és ellenőrzi a lejáratot.

A tokenből csak az ellenőrzött `userId` szolgál azonosításra. A guard minden
védett kérésnél az adatbázisból tölti be az aktuális `id`, `role` és `bannedAt` értéket,
és ezekkel állítja be a `request.user`-t. A `RolesGuard` ezután ellenőrzi az
adott végpont által megengedett szerepköröket. A kliens `x-user-id` és
`x-user-role` fejléceit egyik guard sem használja.

- Hiányzó, érvénytelen vagy lejárt session, illetve törölt felhasználó: **401**.
- Hitelesített, de elégtelen jogosultságú felhasználó: **403**.
- A szerepkör változása a következő védett kérésnél érvényesül.
- Tiltott (`bannedAt !== null`) vagy `GUEST` felhasználó: **403**.
- A korábban nyilvános lekérdezések továbbra is nyilvánosak.

## Globális védelem és szerepkörök

Az `AuthModule` két `APP_GUARD` providert regisztrál `useExisting` kapcsolással:
először a `NextAuthGuard`, utána a `RolesGuard` fut. Lokális guard-deklaráció
nem szükséges. Új végpont alapértelmezetten hitelesítést igényel.

- `@Public()`: az adott végpont nem igényel sessiont. A role guardot nem kerüli meg;
  szerepkörkorlátozással együtt használva nem válik nyilvánossá a végpont.
- `@Roles('ADMIN')`: pontos szerepkörlista, változatlan szemantikával.
- `@MinRole(Role.MODERATOR)`: a központi hierarchia szerint MODERATOR és ADMIN.
- `@MinRole(Role.USER)`: USER, MODERATOR és ADMIN; GUEST nem kap felhasználói jogot.
- A metódus saját metadata-értéke felülírja ugyanannak a dekorátornak az
  osztályszintű értékét. Ha `@Roles` és `@MinRole` is van, mindkettő teljesüljön.

A Users CRUD öt végpontja `@Roles('ADMIN')` védelmet kapott. A három sajátprofil-
végpont minden nem tiltott, regisztrált felhasználónak elérhető. Az admin PATCH
csak `name` és `image` mezőt fogad el; az auth belső jelszó- és verifikációs
frissítése továbbra is külön service-metóduson működik.

Nyilvános: register, login, verify, forgotpassword, resetpassword, logout;
foods GET (history kivételével), ingredients GET, stores GET,
product-availability GET és health. A food módosítások, history, restore és
képműveletek minimum MODERATOR jogosultságot igényelnek. Az ingredients, stores
és product-availability módosítások továbbra is kizárólag ADMIN-nak elérhetők.

A credentials login elutasítja a tiltott felhasználót. A frontend NextAuth
`signIn` callbackje minden belépési módnál ellenőriz, az induló `jwt` callback
ismét ellenőriz. Session-frissítéskor a tiltott felhasználó `GUEST` szerepkört,
üres azonosítót és `isBanned: true` jelölést kap. Az API-védelem ettől függetlenül,
minden kérésnél az adatbázisból érvényesíti a tiltást.

## Konfiguráció

- A frontend és az API **azonos `NEXTAUTH_SECRET`** értéket használjon.
  Eltérő kulccsal az API nem tudja elfogadni a frontend sessionjét.
- A `NEXTAUTH_URL` a frontend címe (fejlesztésben alapértelmezetten
  `http://localhost:4000`). A módosító cookie-alapú kérések `Origin` fejlécének
  ezzel az originnel kell egyeznie; hiányzó vagy eltérő eredetnél **403** a válasz.
  Ez a cookie-alapú műveletek CSRF-védelme. A böngésző az `Origin` fejlécet
  automatikusan küldi; a frontendnek nem kell kézzel beállítania.
- A frontend továbbra is `credentials: 'include'` beállítással hívja az API-t.
  A session cookie-nak el kell jutnia az API-hoz. A jelenlegi host-only cookie
  használható például `localhost:4000` és `localhost:3001` között; két különböző
  hostnévnél megfelelő proxy vagy külön megtervezett cookie-beállítás szükséges.
- Az új kód telepítése előtt alkalmazandó:
  `20261118120000_add_user_ban_fields`. Két nullable oszlopot ad hozzá;
  adatbázis-reset vagy adatátírás nem szükséges. A Prisma klienst újra kell generálni.

## Tesztek

```bash
pnpm --filter @kajai/api test:auth
```

A tesztek a webalkalmazás telepített NextAuth-kódolójával készítik a sessiont.
Valódi HTTP-kérésekkel ellenőrzik az alapanyagok, összetevők, boltok és
termékelérhetőségek módosító végpontjait, a védett historyt és a publikus
lekérdezéseket. A `rbac.integration.spec.ts` a valódi `AuthModule` globális
guardjait, Users CRUD-ját, sajátprofil- és auth-folyamatait teszteli.
Az adatbázis- és email I/O szimulált; éles adatbázist nem módosít.

Részletes implementációs és ellenőrzési jegyzőkönyv: `docs/KAI-77-phase-1.md`.
