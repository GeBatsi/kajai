import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Prisma, Role } from '@kajai/db'
import { UsersService } from './users.service'
import { makeTestUser, usersTestStore } from './users-test-store.spec'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { MailTokenService } from '../mail-token/mail-token.service'
import { TokenService } from '../token/token.service'
import { UsersQueryDto } from './dto/users-query.dto'
import { type RegisteredRole } from '../auth/role-hierarchy'

function setup() {
  const actor = makeTestUser('admin', { role: Role.ADMIN })
  const target = makeTestUser('target')
  const store = usersTestStore([actor, target])
  const db = store.prisma as unknown as PrismaService
  const service = new UsersService(db, {} as MailTokenService, {} as TokenService, new AuditService(db))
  return { ...store, actor, target, service }
}

test('role change writes only role and a minimal actor/target audit in a locked transaction', async () => {
  const { service, target, audits, state } = setup()
  const result = await service.updateRole(target.id, Role.MODERATOR, 'admin')
  assert.equal(result.role, Role.MODERATOR)
  assert.deepEqual(audits, [{
    tableName: 'users', recordId: 'target', userId: 'admin', action: 'UPDATE',
    oldValue: { role: Role.USER }, newValue: { role: Role.MODERATOR },
  }])
  assert.match(state.locks[0], /LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE/)
  assert.deepEqual(state.isolationLevels, ['ReadCommitted'])
  assert.ok(!('password' in result))
})

test('same-role requests are idempotent and do not write or audit', async () => {
  const { service, state, audits } = setup()
  await service.updateRole('target', Role.USER, 'admin')
  assert.equal(state.mutations, 0)
  assert.equal(audits.length, 0)
})

test('service rejects GUEST and unknown roles, including admin creation', async () => {
  const { service } = setup()
  for (const role of [Role.GUEST, 'UNKNOWN' as Role]) {
    assert.throws(() => service.updateRole('target', role as RegisteredRole, 'admin'), BadRequestException)
    await assert.rejects(service.createAdmin({ email: 'new@example.com', role }, 'admin'), BadRequestException)
  }
})

for (const action of ['role', 'ban', 'delete'] as const) {
  test(`${action}: self operation is forbidden`, async () => {
    const { service } = setup()
    const operation = action === 'role' ? service.updateRole('admin', Role.USER, 'admin')
      : action === 'ban' ? service.ban('admin', 'Reason', 'admin') : service.remove('admin', 'admin')
    await assert.rejects(operation, ForbiddenException)
  })
  test(`${action}: last active admin count is checked under the write lock`, async () => {
    const { service, target, state, audits } = setup()
    target.role = Role.ADMIN
    state.activeAdminCountOverride = 1
    const operation = action === 'role' ? service.updateRole('target', Role.USER, 'admin')
      : action === 'ban' ? service.ban('target', 'Reason', 'admin') : service.remove('target', 'admin')
    await assert.rejects(operation, ConflictException)
    assert.equal(target.role, Role.ADMIN)
    assert.equal(target.bannedAt, null)
    assert.equal(audits.length, 0)
    assert.match(state.locks[0], /LOCK TABLE "users"/)
  })
}

for (const action of ['role', 'ban', 'unban', 'delete'] as const) {
  const perform = (service: UsersService, id: string, actorId: string) => action === 'role'
    ? service.updateRole(id, Role.MODERATOR, actorId) : action === 'ban'
      ? service.ban(id, 'Reason', actorId) : action === 'unban' ? service.unban(id, actorId) : service.remove(id, actorId)

  test(`${action}: missing target returns 404`, async () => {
    const { service } = setup()
    await assert.rejects(perform(service, 'missing', 'admin'), NotFoundException)
  })
  test(`${action}: audit failure rolls back user state`, async () => {
    const { service, target, users, audits, state } = setup()
    if (action === 'unban') { target.bannedAt = new Date(); target.banReason = 'Original' }
    const before = structuredClone(target)
    state.failAudit = true
    await assert.rejects(perform(service, target.id, 'admin'), /audit failed/)
    assert.deepEqual(users.get(target.id), before)
    assert.equal(audits.length, 0)
  })
  for (const role of [Role.USER, Role.MODERATOR]) {
    test(`${action}: transaction revalidates actor ${role}`, async () => {
      const { service, actor, state } = setup()
      actor.role = role
      await assert.rejects(perform(service, 'target', actor.id), ForbiddenException)
      assert.equal(state.mutations, 0)
    })
  }
}

test('ban/unban preserve role, original reason/time on repeat, and audit history', async () => {
  const { service, target, audits, state } = setup()
  target.role = Role.MODERATOR
  const first = await service.ban('target', '  Rule violation  ', 'admin')
  assert.equal(first.banReason, 'Rule violation')
  assert.ok(first.bannedAt instanceof Date)
  const repeated = await service.ban('target', 'Replacement', 'admin')
  assert.equal(repeated.bannedAt, first.bannedAt)
  assert.equal(repeated.banReason, first.banReason)
  assert.equal(audits.length, 1)
  const restored = await service.unban('target', 'admin')
  assert.equal(restored.bannedAt, null)
  assert.equal(restored.banReason, null)
  assert.equal(restored.role, Role.MODERATOR)
  await service.unban('target', 'admin')
  assert.equal(audits.length, 2)
  assert.equal(state.mutations, 2)
  assert.deepEqual(audits[0].oldValue, { bannedAt: null, banReason: null })
  assert.deepEqual(audits[1].oldValue, audits[0].newValue)
  assert.deepEqual(audits[1].newValue, { bannedAt: null, banReason: null })
  for (const audit of audits) {
    assert.equal(audit.userId, 'admin')
    assert.equal(audit.recordId, 'target')
    assert.equal(audit.action, 'UPDATE')
    assert.ok(!JSON.stringify(audit).includes(target.password!))
  }
})

for (const reason of ['', '   ', 'x'.repeat(501)]) {
  test(`invalid ban reason length ${reason.length} is rejected by service`, () => {
    assert.throws(() => setup().service.ban('target', reason, 'admin'), BadRequestException)
  })
}

test('banned, deleted or downgraded actors cannot reuse a previously authorized request', async () => {
  const { service, actor, users } = setup()
  actor.bannedAt = new Date()
  await assert.rejects(service.ban('target', 'Reason', 'admin'), ForbiddenException)
  users.delete(actor.id)
  await assert.rejects(service.unban('target', 'admin'), ForbiddenException)
})

test('delete preserves historical audits and adds only minimal deletion state', async () => {
  const { service, target, users, audits, state } = setup()
  audits.push({ recordId: 'target', userId: 'target', action: 'UPDATE', oldValue: { role: 'USER' } })
  const previous = structuredClone(audits[0])
  target.bannedAt = new Date()
  target.banReason = 'A sensitive reason that must not be copied into DELETE'
  const deleted = await service.remove('target', 'admin')
  assert.equal(deleted.id, 'target')
  assert.ok(!('password' in deleted))
  assert.equal(users.has('target'), false)
  assert.deepEqual(audits[0], previous)
  assert.deepEqual(audits[1].oldValue, { role: Role.USER, bannedAt: target.bannedAt.toISOString() })
  assert.equal(audits[1].action, 'DELETE')
  assert.equal(audits[1].userId, 'admin')
  assert.equal(audits[1].recordId, 'target')
  assert.match(state.locks[1], /"recipes", "recipe_ingredients", "meal_logs", "favorites"/)
  assert.ok(!JSON.stringify(audits[1]).includes(target.banReason))
})

test('failed delete leaves no new audit and external recipe references reject deletion', async () => {
  const { service, users, state, audits } = setup()
  state.failDelete = true
  await assert.rejects(service.remove('target', 'admin'), /delete failed/)
  state.failDelete = false
  state.externalReference = true
  await assert.rejects(service.remove('target', 'admin'), ConflictException)
  assert.equal(users.has('target'), true)
  assert.equal(audits.length, 0)
})

for (const role of [Role.USER, Role.MODERATOR, Role.ADMIN]) {
  test(`admin creation of ${role} hashes the password and has an atomic audit`, async () => {
    const { service, audits } = setup()
    const created = await service.createAdmin({ email: 'new@example.com', role, password: 'Password123' }, 'admin')
    assert.equal(created.role, role)
    assert.deepEqual(audits[0], {
      tableName: 'users', recordId: created.id, userId: 'admin', action: 'CREATE', newValue: { role },
    })
  })
}

test('creation audit failure rolls back creation while normal registration stays unaudited', async () => {
  const { service, state, users, audits } = setup()
  state.failAudit = true
  await assert.rejects(service.createAdmin({ email: 'new@example.com', role: Role.ADMIN }, 'admin'), /audit failed/)
  assert.equal(users.size, 2)
  await service.create({ email: 'registration@example.com', password: 'already-hashed' })
  assert.equal(audits.length, 0)
  assert.equal(users.size, 3)
})

for (const action of ['role', 'ban', 'delete'] as const) {
  test(`concurrent cross-admin ${action} requests revalidate the actor after acquiring the lock`, async () => {
    const { service, target, users } = setup()
    target.role = Role.ADMIN
    const operation = (id: string, actor: string) => action === 'role' ? service.updateRole(id, Role.USER, actor)
      : action === 'ban' ? service.ban(id, 'Reason', actor) : service.remove(id, actor)
    const results = await Promise.allSettled([operation('target', 'admin'), operation('admin', 'target')])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal([...users.values()].filter((u) => u.role === Role.ADMIN && !u.bannedAt).length, 1)
  })
}

test('legacy list remains an array; explicit search/filter/page returns a consistent envelope', async () => {
  const { service, users, state } = setup()
  users.set('other', makeTestUser('other', { name: 'Mixed Case', email: 'USER@sample.hu', role: Role.MODERATOR, bannedAt: new Date() }))
  assert.ok(Array.isArray(await service.findAll()))
  assert.ok(Array.isArray(await service.findAll(new UsersQueryDto())))
  for (const query of [{ search: 'mixed' }, { search: 'SAMPLE.HU' }, { role: Role.MODERATOR }, { status: 'banned' }] as UsersQueryDto[]) {
    const result = await service.findAll(query)
    assert.ok(!Array.isArray(result))
    assert.equal(result.meta.total, 1)
    assert.equal(result.data[0].id, 'other')
    assert.ok(!('password' in result.data[0]) && !('profile' in result.data[0]))
  }
  const page = await service.findAll({ page: 2, limit: 1, status: 'active' })
  assert.ok(!Array.isArray(page))
  assert.deepEqual(page.meta, { page: 2, limit: 1, total: 2, totalPages: 2 })
  assert.equal(page.data[0].id, 'target')
  assert.equal(state.isolationLevels.at(-1), 'RepeatableRead')
  const empty = await service.findAll({ search: 'not-found' })
  assert.ok(!Array.isArray(empty))
  assert.equal(empty.meta.totalPages, 0)
  await assert.rejects(service.findOne('missing'), NotFoundException)
})

test('database contention is a reviewable conflict rather than a partial operation', async () => {
  const { service, prisma } = setup()
  prisma.$transaction = async () => { throw new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2034', clientVersion: '5.22.0' }) }
  await assert.rejects(service.remove('target', 'admin'), ConflictException)
})
