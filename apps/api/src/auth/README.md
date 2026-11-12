# Sessionalapú API-hitelesítés

A `NextAuthGuard` a `kajai-session` HttpOnly cookie-t ellenőrzi, beleértve
a NextAuth által több cookie-ba darabolt sessiont is. A telepített NextAuth v4
alapértelmezett titkosított tokenformátumát használja, és ellenőrzi a lejáratot.

A tokenből csak az ellenőrzött `userId` szolgál azonosításra. A guard minden
védett kérésnél az adatbázisból tölti be az aktuális `id` és `role` értéket,
és ezekkel állítja be a `request.user`-t. A `RolesGuard` ezután ellenőrzi az
adott végpont által megengedett szerepköröket. A kliens `x-user-id` és
`x-user-role` fejléceit egyik guard sem használja.

- Hiányzó, érvénytelen vagy lejárt session, illetve törölt felhasználó: **401**.
- Hitelesített, de elégtelen jogosultságú felhasználó: **403**.
- A szerepkör változása a következő védett kérésnél érvényesül.
- A korábban nyilvános lekérdezések továbbra is nyilvánosak.

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
- Új adatbázis-migráció nem szükséges.

## Tesztek

```bash
pnpm --filter @kajai/api test:auth
```

A tesztek a webalkalmazás telepített NextAuth-kódolójával készítik a sessiont.
Valódi HTTP-kérésekkel ellenőrzik az alapanyagok, összetevők, boltok és
termékelérhetőségek mind a 14 érintett módosító végpontját. A tesztadatbázis
szimulált; a felhasználókezelő végpontokat ez a tesztcsomag nem módosítja.
