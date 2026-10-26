# Alapanyagok név–kategória egyedisége

A `20261025120000_unique_basic_food_name_category` migráció csak a `BASIC`
rekordokra hoz létre egyedi indexet. Az összehasonlítás mindkét mezőn
`lower(btrim(...))` szerint történik: a kis/nagybetűk és a szélső szóközök
nem számítanak. A `NULL`, üres és csak szóközből álló kategóriák azonosak.
A belső szóközök és az ékezetek számítanak. A `PRODUCT` rekordokra ez az
egyediségi szabály nem vonatkozik.

## Bevezetés

A projekt gyökeréből, a céladatbázisra beállított `DATABASE_URL` változóval:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/checks/basic-food-duplicates.sql
```

Ez kizárólag olvas. Ha sorokat ad vissza, azok felsorolják az ütköző rekordokat
azonosítóval, eredeti névvel és kategóriával. Ezek rendezéséről külön kell
dönteni a kapcsolódó receptek, naplóbejegyzések és egyéb hivatkozások miatt.
Sem az ellenőrzés, sem a migráció nem töröl vagy von össze rekordokat.

Ha nincs találat, a projekt szokásos migrációs parancsa alkalmazható:

```bash
pnpm --filter @kajai/db migrate:deploy
```

A parancs a csomag scriptjének megfelelően a gyökér `.env` fájljából is
tölti a beállításokat; ellenőrizd, hogy ugyanazt a céladatbázist használja.
Az index nélkül az API előzetes ellenőrzése önmagában nem véd a párhuzamos
létrehozástól. Ha az ellenőrzés óta új duplikátum keletkezett, az index
létrehozása hibával megáll, az adatok megmaradnak.

Az index kifejezéseit és részleges feltételét a Prisma 5 sémája nem tudja
leírni. A SQL migráció tartja fenn őket; a `db push` nem helyettesíti ezt a
migrációt. A service ellenőrzésének és a listázó SQL-nek az indexszel azonos
normalizálást kell használnia.

## Tesztek

```bash
pnpm --filter @kajai/api test:foods
```

Ez típusellenőrzést és a kapcsolódó unit teszteket futtatja. A PostgreSQL
integrációs tesztekhez külön tesztadatbázis szükséges:

```bash
FOOD_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/TEST_DB' pnpm --filter @kajai/api test:foods
```

Az integrációs teszt saját, véletlen nevű sémát hoz létre, arra alkalmazza
az induló migrációt és az új indexet, majd a végén csak ezt a sémát törli.
A tesztfelhasználónak séma létrehozására és törlésére is jogosultnak kell
lennie. A teszt ellenőrzi a meglévő duplikátumok felismerését, a sikertelen
migráció adatmegőrzését, a service hibaválaszait, a párhuzamos létrehozást,
az auditot és a vesztes kérés képének takarítását.
