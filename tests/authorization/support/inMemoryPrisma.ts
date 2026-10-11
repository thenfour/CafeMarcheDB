type TestRow = {
  id: number
  [key: string]: unknown
}
import { Permission } from "shared/permissions"

type Seed = Record<string, TestRow[]>

const defaultAuthorizationRoles: TestRow[] = [
  {
    id: 900_001,
    name: "Public",
    isPublicRole: true,
    isSysAdminRole: false,
    permissions: ["always_grant", "public", "visibility_public", "view_events", "view_files", "practice_tools_use"]
      .map((name, index) => ({ id: 910_000 + index, permissionId: 920_000 + index, permission: { id: 920_000 + index, name } })),
  },
  {
    id: 900_002,
    name: "Sysadmin",
    isPublicRole: false,
    isSysAdminRole: true,
    permissions: Object.values(Permission).filter(name => name !== Permission.never_grant)
      .map((name, index) => ({ id: 930_000 + index, permissionId: 940_000 + index, permission: { id: 940_000 + index, name } })),
  },
]

const clone = <T>(value: T): T => structuredClone(value)

const hasNumericId = (row: Record<string, unknown>): row is TestRow => typeof row.id === "number"

const requireTestRow = (row: Record<string, unknown>): TestRow => {
  if (!hasNumericId(row)) throw new Error("In-memory rows require a numeric id")
  return row
}

function matchesScalar(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const expression = expected as Record<string, unknown>
    if ("equals" in expression) return actual === expression.equals
    if ("in" in expression) return (expression.in as unknown[]).includes(actual)
    if ("notIn" in expression) return Array.isArray(expression.notIn) && !expression.notIn.includes(actual)
    if ("not" in expression) return !matchesScalar(actual, expression.not)
    if ("contains" in expression) {
      return typeof actual === "string" && actual.includes(String(expression.contains))
    }
    if ("gte" in expression) return actual != null && (actual as any) >= (expression.gte as any)
    if ("gt" in expression) return actual != null && (actual as any) > (expression.gt as any)
    if ("lte" in expression) return actual != null && (actual as any) <= (expression.lte as any)
    if ("lt" in expression) return actual != null && (actual as any) < (expression.lt as any)
    if ("some" in expression) {
      return Array.isArray(actual)
        && actual.some(item => matchesWhere(item as TestRow, expression.some as Record<string, unknown>))
    }
    if ("is" in expression) {
      return actual != null
        && matchesWhere(actual as TestRow, expression.is as Record<string, unknown>)
    }
    if (actual && typeof actual === "object") {
      return matchesWhere(actual as TestRow, expression)
    }
  }
  return actual === expected
}

export function matchesWhere(row: TestRow, where: Record<string, unknown> | undefined): boolean {
  if (!where || Object.keys(where).length === 0) return true

  return Object.entries(where).every(([field, expected]) => {
    if (field === "AND") {
      const clauses = Array.isArray(expected) ? expected : [expected]
      return clauses.every((clause) => matchesWhere(row, clause as Record<string, unknown>))
    }
    if (field === "OR") {
      const clauses = Array.isArray(expected) ? expected : [expected]
      return clauses.some((clause) => matchesWhere(row, clause as Record<string, unknown>))
    }
    if (field === "NOT") {
      const clauses = Array.isArray(expected) ? expected : [expected]
      return clauses.every((clause) => !matchesWhere(row, clause as Record<string, unknown>))
    }
    // Prisma compound unique selectors describe several scalar columns.
    if (["bandId_userId", "bandId_slug", "localeId_stringId", "stringKey_localeId", "stringKey_localeId_bandId", "bandId_name", "userId_name", "bandUserId_name"].includes(field)) {
      return isRecord(expected) && matchesWhere(row, expected)
    }
    return matchesScalar(row[field], expected)
  })
}

interface QueryArgs {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  take?: number;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

type Relation = { table: string; local: string; foreign: string; many?: boolean }
// Dynamic table names mirror Prisma; only relations exercised by these integration tests are listed.
const testRelations: Record<string, Record<string, Relation>> = {
  user: {
    globalRole: { table: "globalRole", local: "globalRoleId", foreign: "id" },
    signInMethods: { table: "userSignInMethod", local: "id", foreign: "userId", many: true },
  },
  band: {
    locales: { table: "bandLocale", local: "id", foreign: "bandId", many: true },
  },
  bandLocale: {
    locale: { table: "locale", local: "localeId", foreign: "id" },
  },
  locale: {
    bandLocales: { table: "bandLocale", local: "id", foreign: "localeId", many: true },
  },
  staticLocalizedStringValue: { locale: { table: "locale", local: "localeId", foreign: "id" } },
  bandStaticLocalizedStringValue: { locale: { table: "locale", local: "localeId", foreign: "id" } },
  dynamicLocalizedStringValue: { locale: { table: "locale", local: "localeId", foreign: "id" } },
  bandDynamicLocalizedStringValue: { locale: { table: "locale", local: "localeId", foreign: "id" } },
  globalRole: {
    permissions: { table: "globalRolePermission", local: "id", foreign: "globalRoleId", many: true },
  },
  globalRolePermission: {
    permission: { table: "permission", local: "permissionId", foreign: "id" },
  },
  bandRole: {
    bandRolePermissions: { table: "bandRolePermission", local: "id", foreign: "bandRoleId", many: true },
  },
  bandRolePermission: {
    permission: { table: "permission", local: "permissionId", foreign: "id" },
  },
  bandUser: {
    user: { table: "user", local: "userId", foreign: "id" },
    bandRole: { table: "bandRole", local: "bandRoleId", foreign: "id" },
    bandUserInstruments: { table: "bandUserInstrument", local: "id", foreign: "bandUserId", many: true },
    bandUserTagAssignments: { table: "bandUserTagAssignment", local: "id", foreign: "bandUserId", many: true },
  },
  bandUserInstrument: {
    bandUser: { table: "bandUser", local: "bandUserId", foreign: "id" },
    bandInstrument: { table: "bandInstrument", local: "bandInstrumentId", foreign: "id" },
  },
  bandUserTagAssignment: {
    bandUser: { table: "bandUser", local: "bandUserId", foreign: "id" },
    bandUserTag: { table: "bandUserTag", local: "bandUserTagId", foreign: "id" },
  },
  wikiPage: {
    revisions: { table: "wikiPageRevision", local: "id", foreign: "wikiPageId", many: true },
    createdByUser: { table: "user", local: "createdByUserId", foreign: "id" },
    visiblePermission: { table: "permission", local: "visiblePermissionId", foreign: "id" },
    lockedByUser: { table: "user", local: "lockedByUserId", foreign: "id" },
    currentRevision: { table: "wikiPageRevision", local: "currentRevisionId", foreign: "id" },
  },
  wikiPageRevision: { wikiPage: { table: "wikiPage", local: "wikiPageId", foreign: "id" } },
  event: {
    createdByUser: { table: "user", local: "createdByUserId", foreign: "id" },
    visiblePermission: { table: "permission", local: "visiblePermissionId", foreign: "id" },
    responses: { table: "eventUserResponse", local: "id", foreign: "eventId", many: true },
    segments: { table: "eventSegment", local: "id", foreign: "eventId", many: true },
    songLists: { table: "eventSongList", local: "id", foreign: "eventId", many: true },
  },
  eventSongList: {
    event: { table: "event", local: "eventId", foreign: "id" },
    songs: { table: "eventSongListSong", local: "id", foreign: "eventSongListId", many: true },
    dividers: { table: "eventSongListDivider", local: "id", foreign: "eventSongListId", many: true },
  },
  frontpageGalleryItem: {
    file: { table: "file", local: "fileId", foreign: "id" },
  },
  eventSongListSong: {
    eventSongList: { table: "eventSongList", local: "eventSongListId", foreign: "id" },
    song: { table: "song", local: "songId", foreign: "id" },
  },
  eventSongListDivider: {
    eventSongList: { table: "eventSongList", local: "eventSongListId", foreign: "id" },
  },
  eventSegment: {
    event: { table: "event", local: "eventId", foreign: "id" },
    status: { table: "eventStatus", local: "statusId", foreign: "id" },
    responses: { table: "eventSegmentUserResponse", local: "id", foreign: "eventSegmentId", many: true },
  },
  eventUserResponse: {
    event: { table: "event", local: "eventId", foreign: "id" },
    instrument: { table: "instrument", local: "instrumentId", foreign: "id" },
  },
  eventSegmentUserResponse: {
    eventSegment: { table: "eventSegment", local: "eventSegmentId", foreign: "id" },
    attendance: { table: "eventAttendance", local: "attendanceId", foreign: "id" },
  },
  songCredit: {
    user: { table: "user", local: "userId", foreign: "id" },
    song: { table: "song", local: "songId", foreign: "id" },
  },
  userSignInMethod: {
    user: { table: "user", local: "userId", foreign: "id" },
  },
  change: {
    user: { table: "user", local: "userId", foreign: "id" },
  },
  setlistPlan: {
    createdByUser: { table: "user", local: "createdByUserId", foreign: "id" },
    visiblePermission: { table: "permission", local: "visiblePermissionId", foreign: "id" },
    group: { table: "setlistPlanGroup", local: "groupId", foreign: "id" },
  },
  setlistPlanGroup: {
    createdByUser: { table: "user", local: "createdByUserId", foreign: "id" },
  },
}

export class InMemoryDelegate {
  private rows: TestRow[] = []

  constructor(
    private readonly createDefaults: Record<string, unknown> = {},
    private readonly readRelations: (row: TestRow, args: QueryArgs) => TestRow = row => row,
    private readonly onDelete: (rows: TestRow[]) => Promise<void> = async () => {},
    private readonly normalizeWrite: (row: TestRow) => TestRow = row => row,
  ) {}

  reset(rows: TestRow[]) {
    this.rows = clone(rows)
  }

  snapshot() {
    return clone(this.rows)
  }

  async findFirst(args: QueryArgs = {}) {
    return (await this.findMany({ ...args, take: 1 }))[0] ?? null
  }

  async findUnique(args: QueryArgs = {}) {
    return this.findFirst(args)
  }

  async findUniqueOrThrow(args: QueryArgs = {}) {
    const row = await this.findUnique(args)
    if (!row) throw new Error("In-memory row was not found")
    return row
  }

  async findMany(args: QueryArgs = {}) {
    const matches = this.rows.map(row => this.readRelations(clone(row), args))
      .filter(candidate => matchesWhere(candidate, args.where))
    const orders = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : []
    matches.sort((a, b) => {
      for (const order of orders) {
        for (const [key, direction] of Object.entries(order)) {
          const left = a[key], right = b[key]
          if (typeof left === "number" && typeof right === "number" && left !== right) {
            return (left - right) * (direction === "desc" ? -1 : 1)
          }
        }
      }
      return 0
    })
    return clone(args.take === undefined ? matches : matches.slice(0, args.take))
  }

  async count(args: { where?: Record<string, unknown> } = {}) {
    return (await this.findMany(args)).length
  }

  async create(args: { data: Omit<TestRow, "id"> & Partial<Pick<TestRow, "id">>; select?: Record<string, unknown>; include?: Record<string, unknown> }) {
    const nextId = this.rows.reduce((highest, row) => Math.max(highest, row.id), 0) + 1
    const row = this.normalizeWrite(requireTestRow({
      ...clone(this.createDefaults),
      ...clone(args.data),
      id: args.data.id ?? nextId,
    }))
    this.rows.push(row)
    return clone(this.readRelations(clone(row), args))
  }

  async update(args: { where: { id: number }; data: Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown> }) {
    const index = this.rows.findIndex((row) => row.id === args.where.id)
    if (index < 0) throw new Error(`In-memory row ${args.where.id} was not found`)
    this.rows[index] = this.normalizeWrite(requireTestRow({ ...this.rows[index], ...clone(args.data) }))
    return clone(this.readRelations(clone(this.rows[index]), args))
  }

  async upsert(args: { where: NonNullable<QueryArgs["where"]>; create: Omit<TestRow, "id">; update: Record<string, unknown> }) {
    const row = await this.findUnique({ where: args.where });
    return row ? this.update({ where: { id: row.id }, data: args.update }) : this.create({ data: args.create });
  }

  async createMany(args: { data: Array<Omit<TestRow, "id"> & Partial<Pick<TestRow, "id">>> }) {
    for (const data of args.data) await this.create({ data })
    return { count: args.data.length }
  }

  async updateMany(args: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
    let count = 0
    this.rows = this.rows.map((row) => {
      if (!matchesWhere(row, args.where)) return row
      count += 1
      return this.normalizeWrite(requireTestRow({ ...row, ...clone(args.data) }))
    })
    return { count }
  }

  async deleteMany(args: { where?: Record<string, unknown> } = {}) {
    const retained = this.rows.filter((row) => !matchesWhere(row, args.where))
    const count = this.rows.length - retained.length
    const removed = this.rows.filter(row => matchesWhere(row, args.where))
    this.rows = retained
    await this.onDelete(removed)
    return { count }
  }

  async delete(args: { where: Record<string, unknown> }) {
    const index = this.rows.findIndex((row) => matchesWhere(row, args.where))
    if (index < 0) throw new Error("In-memory row was not found")
    const [deleted] = this.rows.splice(index, 1)
    return clone(deleted!)
  }
}

class AuthorizationTestDatabase {
  private delegates = new Map<string, InMemoryDelegate>()

  reset(seed: Seed = {}, options: { includeAuthorizationRoles?: boolean } = {}) {
    for (const delegate of this.delegates.values()) {
      delegate.reset([])
    }
    for (const [tableName, rows] of Object.entries(seed)) {
      this.getDelegate(tableName).reset(rows)
    }
    const suppliedRoles = seed.role || []
    const missingDefaults = options.includeAuthorizationRoles === false || seed.role !== undefined ? [] : defaultAuthorizationRoles.filter(defaultRole => !suppliedRoles.some(role => (
      (defaultRole.isPublicRole && role.isPublicRole) || (defaultRole.isSysAdminRole && role.isSysAdminRole)
    )))
    this.getDelegate("role").reset([...suppliedRoles, ...missingDefaults])
  }

  snapshot(tableName: string) {
    const rows = this.getDelegate(tableName).snapshot()
    return tableName.toLowerCase() === "role"
      ? rows.filter(row => row.id < 900_000)
      : rows
  }

  async transaction(callback: () => Promise<unknown>) {
    const before = new Map([...this.delegates].map(([name, delegate]) => [name, delegate.snapshot()]))
    try { return await callback() } catch (error) {
      for (const [name, delegate] of this.delegates) delegate.reset(before.get(name) ?? [])
      throw error
    }
  }

  private readRelations(table: string, row: TestRow, args: QueryArgs): TestRow {
    const whereRelations: Record<string, unknown> = {}
    const collectWhere = (where: unknown) => {
      if (!isRecord(where)) return
      for (const [key, value] of Object.entries(where)) {
        if (["AND", "OR", "NOT"].includes(key)) {
          for (const clause of Array.isArray(value) ? value : [value]) collectWhere(clause)
        } else if (testRelations[table]?.[key]) whereRelations[key] = value
      }
    }
    collectWhere(args.where)
    for (const [member, relation] of Object.entries(testRelations[table] ?? {})) {
      const selection = args.select?.[member] ?? args.include?.[member]
      const where = whereRelations[member]
      if (!selection && !where) continue
      const targetArgs: QueryArgs = isRecord(selection) ? selection : {}
      const relationWhere = isRecord(where) && isRecord(where.is) ? where.is : where
      const existing = row[member]
      // Existing embedded fixtures remain authoritative for their own tests.
      const rows = existing !== undefined
        ? (Array.isArray(existing) ? existing : existing ? [existing] : [])
        : this.getDelegate(relation.table).snapshot().filter(target => target[relation.foreign] === row[relation.local])
      const related = rows.filter((value): value is TestRow => isRecord(value) && typeof value.id === "number")
        .map(value => this.readRelations(relation.table, value, {
          ...targetArgs,
          where: isRecord(relationWhere) ? relationWhere : targetArgs.where,
        }))
      const selected = relation.many ? related.filter(value => matchesWhere(value, targetArgs.where)) : related
      row[member] = relation.many ? selected : selected[0] ?? null
    }
    return row
  }

  getDelegate(tableName: string) {
    const prismaDelegateName = `${tableName.charAt(0).toLowerCase()}${tableName.slice(1)}`
    let delegate = this.delegates.get(prismaDelegateName)
    if (!delegate) {
      // Signup relies on User.isDeleted's database default to create active users.
      delegate = new InMemoryDelegate(
        prismaDelegateName === "user"
          ? { isDeleted: false, mergedIntoUserId: null, globalRoleId: null, isSysAdmin: false }
          : prismaDelegateName === "wikiPage"
            ? { contentVersion: 0, currentRevisionId: null, lockId: null, lockedByUserId: null,
                lockAcquiredAt: null, lockExpiresAt: null, lastEditPingAt: null }
          : prismaDelegateName === "event"
            ? { isDeleted: false, startsAt: null, durationMillis: BigInt(0), isAllDay: true }
            : prismaDelegateName === "setlistPlan"
              ? { createdAt: new Date(), sortOrder: 0, isDeleted: false }
            : prismaDelegateName === "setlistPlanGroup"
              ? { createdAt: new Date(), sortOrder: 0 }
            : {},
        (row, args) => this.readRelations(prismaDelegateName, row, args),
        async rows => {
          if (prismaDelegateName !== "eventSongList") return
          for (const child of ["eventSongListSong", "eventSongListDivider"]) {
            await this.getDelegate(child).deleteMany({ where: { eventSongListId: { in: rows.map(row => row.id) } } })
          }
        },
        row => prismaDelegateName === "event" && typeof row.durationMillis === "number"
          ? { ...row, durationMillis: BigInt(row.durationMillis) }
          : row,
      )
      this.delegates.set(prismaDelegateName, delegate)
    }
    return delegate
  }
}

const database = new AuthorizationTestDatabase()

// DB3 descriptors index Prisma with model names (`User`), while direct code
// uses delegate names (`user`). Resolve either form lazily so new tables can be
// tested without growing a handwritten database mock.
export const authorizationTestDb = new Proxy(database, {
  has(target, property) {
    // Snapshot readers detect the transaction capability before calling it.
    return property === "$transaction" || Reflect.has(target, property)
  },
  get(target, property, receiver) {
    if (typeof property !== "string") return Reflect.get(target, property, target)
    if (property === "$transaction") {
      return async (callback: (transaction: typeof receiver) => Promise<unknown>) => target.transaction(() => callback(receiver))
    }
    if (property === "$queryRaw") {
      return async (query: { strings?: readonly string[]; values?: unknown[] }) => {
        const statement = query.strings?.join("?") ?? ""
        if (/FROM\s+`?Role`?\s+ORDER\s+BY\s+id\s+FOR\s+UPDATE/i.test(statement)) {
          return target.getDelegate("role").snapshot().map((role) => ({ id: role.id }))
        }
        if (!/FROM\s+AdminBootstrapClaim/i.test(statement)) {
          throw new Error(`Unsupported authorization-test raw query: ${statement}`)
        }

        const tokenHash = query.values?.[0]
        return target
          .getDelegate("adminBootstrapClaim")
          .snapshot()
          .filter((row) => row.tokenHash === tokenHash)
          .slice(0, 1)
          .map((row) => ({ id: row.id }))
      }
    }
    if (property === "$executeRaw") {
      return async (query: { strings?: readonly string[]; values?: unknown[] }) => {
        const statement = query.strings?.join("?") ?? ""
        if (!/INSERT\s+IGNORE\s+INTO\s+AdminBootstrapClaim/i.test(statement)) {
          throw new Error(`Unsupported authorization-test raw mutation: ${statement}`)
        }

        const [tokenHash, claimedByUserId] = query.values ?? []
        const claims = target.getDelegate("adminBootstrapClaim")
        if (claims.snapshot().some((row) => row.tokenHash === tokenHash)) return 0

        await claims.create({
          data: {
            tokenHash,
            claimedByUserId,
            claimedAt: new Date(),
          },
        })
        return 1
      }
    }
    if (property in target) {
      const value = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    }
    return target.getDelegate(property)
  },
}) as AuthorizationTestDatabase & Record<string, InMemoryDelegate>
