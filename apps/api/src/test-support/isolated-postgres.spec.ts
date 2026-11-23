import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, unlinkSync, writeFileSync, rmdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import type { TestContext } from 'node:test'
import { Prisma, PrismaClient } from '@kajai/db'

const parseDatabaseUrl = (value: string) => {
  try { return new URL(value) }
  catch { throw new Error('Érvénytelen adatbázis-URL; a teszt biztonsági ellenőrzése nem teljesült.') }
}
const identity = (value: string) => {
  const url = parseDatabaseUrl(value)
  // Neon pooled and direct hostnames identify the same database.
  return `${url.hostname.replace(/-pooler(?=\.)/, '')}:${url.port || '5432'}${url.pathname}`
}

type SqlClient = Pick<Prisma.TransactionClient, '$queryRaw'>
type TransactionOptions = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }

async function connectionState(client: SqlClient) {
  const [state] = await client.$queryRaw<{
    database: string; schema: string | null; searchPath: string; schemas: string[]; pid: number
  }[]>`SELECT current_database()::text AS database, current_schema()::text AS schema,
    current_setting('search_path') AS "searchPath", current_schemas(false)::text[] AS schemas,
    pg_backend_pid() AS pid`
  return state
}

async function assertIsolated(client: SqlClient, schema: string, database: string) {
  const state = await connectionState(client)
  assert.equal(state.database, database, 'Izolációs hiba: eltérő céladatbázis.')
  assert.equal(state.schema, schema, `Izolációs hiba: current_schema=${state.schema}; search_path=${state.searchPath}`)
  assert.deepEqual(state.schemas, [schema], 'Izolációs hiba: a search_path más sémát is elér.')
  return state
}

// A URL's Prisma schema setting qualifies model SQL, but is not a raw-SQL isolation
// boundary through a transaction pooler. Pin EVERY root operation and interactive
// transaction to a backend with SET LOCAL before allowing any test/service SQL.
function isolatedClient(base: PrismaClient, schema: string, database: string): PrismaClient {
  const transaction = <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options?: TransactionOptions) => {
    assert.equal(typeof operation, 'function', 'Az izolált tesztkliens csak interaktív tranzakciót enged.')
    return base.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('search_path', ${schema}, true)`
      await assertIsolated(tx, schema, database)
      return operation(tx)
    }, options)
  }
  const modelNames = new Set(Object.values(Prisma.ModelName).map((name) => name[0].toLowerCase() + name.slice(1)))
  const invoke = (target: object, key: string, args: unknown[]) =>
    (Reflect.get(target, key) as (...values: unknown[]) => Promise<unknown>).apply(target, args)
  return new Proxy(base, {
    get(target, key) {
      if (key === '$transaction') return transaction
      if (typeof key === 'string' && modelNames.has(key)) {
        return new Proxy(Reflect.get(target, key) as object, {
          get(_delegate, operation) {
            assert.equal(typeof operation, 'string')
            return (...args: unknown[]) => transaction((tx) => invoke(Reflect.get(tx, key) as object, String(operation), args))
          },
        })
      }
      if (typeof key === 'string' && ['$queryRaw', '$executeRaw', '$queryRawUnsafe', '$executeRawUnsafe'].includes(key)) {
        return (...args: unknown[]) => transaction((tx) => invoke(tx, key, args))
      }
      if (key === '$connect' || key === '$disconnect') return Reflect.get(target, key).bind(target)
      throw new Error('Az izolált tesztkliens nem enged nem ellenőrzött Prisma műveletet.')
    },
  })
}

async function executeMigrations(root: string, url: string, schema: string, database: string, schemaOid: string) {
  const directory = mkdtempSync(join(tmpdir(), 'kai77-users-migrations-'))
  const schemaFile = join(directory, 'schema.prisma')
  const scriptFile = join(directory, 'migrations.sql')
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
  try {
    const datamodel = readFileSync(resolve(root, 'packages/db/prisma/schema.prisma'), 'utf8')
    assert.ok(!/directUrl\s*=/.test(datamodel), 'Izolációs hiba: a migrációs datasource directUrl külön ellenőrzést igényel.')
    writeFileSync(schemaFile, datamodel)
    const migrations = resolve(root, 'packages/db/prisma/migrations')
    const sql = readdirSync(migrations, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => readFileSync(resolve(migrations, entry.name, 'migration.sql'), 'utf8')).join('\n\n')
    // Prisma's official script executor sends the complete SQL batch, including its
    // transaction-local guard, to one backend. Never split SQL on semicolons/comments.
    writeFileSync(scriptFile, `BEGIN;
SET LOCAL search_path = "${schema}";
DO $kai77_isolation$ BEGIN
  IF current_database() IS DISTINCT FROM ${literal(database)}
    OR current_schema() IS DISTINCT FROM ${literal(schema)}
    OR current_schemas(false)::text[] IS DISTINCT FROM ARRAY[${literal(schema)}]::text[]
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${literal(schema)}
      AND oid::text = ${literal(schemaOid)} AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user))
  THEN RAISE EXCEPTION 'KAI-77: a migracio izolacioja nem garantalhato'; END IF;
END $kai77_isolation$;
${sql}
COMMIT;\n`)
    const cli = createRequire(resolve(root, 'packages/db/package.json')).resolve('prisma')
    await new Promise<void>((resolveRun, reject) => {
      const child = spawn(process.execPath, [cli, 'db', 'execute', '--schema', schemaFile, '--file', scriptFile], {
        // Windows keeps a child's working directory locked until all engine handles close.
        cwd: root,
        env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      child.stdout.on('data', (data: Buffer) => { output += data.toString() })
      child.stderr.on('data', (data: Buffer) => { output += data.toString() })
      child.once('error', () => reject(new Error('A Prisma db execute nem indítható.')))
      child.once('close', (code) => {
        if (code === 0) resolveRun()
        else {
          // Do not print connection strings, usernames or passwords from child output.
          const errorCode = output.match(/\bP\d{4}\b/)?.[0] ?? 'ismeretlen hiba'
          reject(new Error(`A Prisma db execute migráció sikertelen (${errorCode}); csak a saját tesztsémát használtuk.`))
        }
      })
    })
  } finally {
    // Only these two files and our newly-created empty temp directory are removed.
    for (const file of [schemaFile, scriptFile]) if (existsSync(file)) unlinkSync(file)
    rmdirSync(directory)
  }
}

export async function isolatedPostgres(t: TestContext, databaseUrl: string, prefix: 'kai77_users_test' | 'kai77_nutrition_test') {
  // Never fall back to DATABASE_URL, and refuse the configured development database.
  const root = resolve(__dirname, '../../../..')
  const configuredUrls = [process.env.DATABASE_URL]
  for (const filename of ['.env', '.env.local', 'apps/api/.env', 'apps/api/.env.local']) {
    const path = resolve(root, filename)
    if (existsSync(path)) {
      const match = readFileSync(path, 'utf8').match(/^DATABASE_URL\s*=\s*["']?([^\r\n"']+)/m)
      if (match) configuredUrls.push(match[1])
    }
  }
  assert.ok(!configuredUrls.filter((url): url is string => !!url).some((url) => identity(url) === identity(databaseUrl!)),
    'The test URL must identify a separate database, not the development database.')
  assert.ok(['kai77_users_test', 'kai77_nutrition_test'].includes(prefix), 'Unknown test schema prefix')
  const schema = `${prefix}_${randomUUID().replaceAll('-', '')}`
  assert.match(schema, /^kai77_(users|nutrition)_test_[a-f0-9]{32}$/)
  const url = parseDatabaseUrl(databaseUrl!)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Kizárólag PostgreSQL tesztadatbázis használható.')
  assert.ok(!url.searchParams.has('host'), 'A host query paraméter megkerülné a céladatbázis ellenőrzését.')
  const database = decodeURIComponent(url.pathname.slice(1))
  assert.ok(database, 'Hiányzó céladatbázis-név.')
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  url.searchParams.set('schema', schema)
  const base = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  const db = isolatedClient(base, schema, database)
  const publicRole = () => admin.$queryRaw<{ oid: string }[]>`SELECT t.oid::text AS oid FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'Role' AND n.nspname = 'public'`
  let schemaOid: string | undefined
  t.after(async () => {
    await db.$disconnect()
    try {
      if (schemaOid) await admin.$transaction(async (tx) => {
        assert.equal((await connectionState(tx)).database, database)
        const owned = await tx.$queryRaw<{ oid: string }[]>`SELECT oid::text AS oid FROM pg_namespace
          WHERE nspname = ${schema} AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)`
        assert.equal(owned[0]?.oid, schemaOid, 'A takarítás csak a teszt által létrehozott sémát törölheti.')
        await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
      })
    }
    finally { await admin.$disconnect() }
  })
  await admin.$transaction(async (tx) => {
    const initial = await connectionState(tx)
    assert.equal(initial.database, database, 'Eltérő céladatbázis; sémalétrehozás megtagadva.')
    t.diagnostic(`Kezdeti raw SQL: current_schema=${initial.schema}; search_path=${initial.searchPath}`)
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    const [created] = await tx.$queryRaw<{ oid: string }[]>`SELECT oid::text AS oid FROM pg_namespace WHERE nspname = ${schema}`
    schemaOid = created.oid
  })
  const originalPublicRole = await publicRole()
  const before = await db.$transaction((tx) => assertIsolated(tx, schema, database))
  t.diagnostic(`Izolált raw SQL: current_schema=${before.schema}; search_path=${before.searchPath}`)
  // Check independent clients/new physical connections before executing any migration.
  const probes = Array.from({ length: 2 }, () => new PrismaClient({ datasources: { db: { url: url.toString() } } }))
  try {
    await Promise.all(probes.map((probe) => isolatedClient(probe, schema, database).$transaction((tx) => assertIsolated(tx, schema, database))))
  } finally { await Promise.all(probes.map((probe) => probe.$disconnect())) }
  await executeMigrations(root, url.toString(), schema, database, schemaOid!)
  const types = await db.$queryRaw<{ schema: string }[]>`SELECT n.nspname::text AS schema FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'Role' AND n.nspname = current_schema()`
  assert.deepEqual(types, [{ schema }], 'A migráció Role típusa nem a saját tesztsémába került.')
  assert.deepEqual(await publicRole(), originalPublicRole, 'A public.Role típusnak változatlanul meg kell maradnia.')
  // Force reconnect: root model operations and service transactions must remain isolated.
  await db.$disconnect()
  await db.$transaction((tx) => assertIsolated(tx, schema, database))
  assert.equal(await db.user.count(), 0, 'A Prisma modellművelet nem az üres tesztsémát látja.')
  return { db, schema, database }
}
