import { Prisma } from "@prisma/client";

// Prisma model rows vary across the fixture's delegates.
export type TestRow = {
  id: number
  [key: string]: unknown
}

// This double stores rows from several Prisma models without owning their policies.
export type Seed = Record<string, TestRow[]>

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

// Prisma scalar updates change the stored number instead of storing the operation object.
function applyScalarUpdates(row: TestRow, data: Record<string, unknown>): TestRow {
  const updated = { ...row }
  for (const [field, value] of Object.entries(data)) {
    const current = row[field]
    if (isRecord(value) && typeof value.increment === "number" && typeof current === "number") {
      updated[field] = current + value.increment
    } else {
      updated[field] = clone(value)
    }
  }
  return updated
}

type Relation = { table: string; local: string; foreign: string; many?: boolean }
// The generated schema supplies relation keys; the double owns no model policy.
function buildTestRelations(): Record<string, Record<string, Relation>> {
  const models = Prisma.dmmf.datamodel.models;
  const result: Record<string, Record<string, Relation>> = {};
  for (const model of models) {
    const relations: Record<string, Relation> = {};
    for (const field of model.fields.filter(field => field.kind === "object")) {
      let local = field.relationFromFields?.[0];
      let foreign = field.relationToFields?.[0];
      if (!local || !foreign) {
        const inverse = models.find(target => target.name === field.type)?.fields.find(candidate =>
          candidate.type === model.name && candidate.relationName === field.relationName
          && candidate.relationFromFields?.length === 1);
        local = inverse?.relationToFields?.[0];
        foreign = inverse?.relationFromFields?.[0];
      }
      if (local && foreign) {
        const table = field.type.charAt(0).toLowerCase() + field.type.slice(1);
        relations[field.name] = { table, local, foreign, many: field.isList };
      }
    }
    result[model.name.charAt(0).toLowerCase() + model.name.slice(1)] = relations;
  }
  return result;
}
const testRelations = buildTestRelations();

function normalizePrismaScalars(table: string, row: TestRow): TestRow {
  const model = Prisma.dmmf.datamodel.models.find(model => model.name.charAt(0).toLowerCase() + model.name.slice(1) === table);
  for (const field of model?.fields ?? []) {
    const value = row[field.name];
    if (field.type === "BigInt" && typeof value === "number") {
      row[field.name] = BigInt(value);
    }
  }
  return row;
}

function normalizePrismaUniqueWhere(table: string, where: QueryArgs["where"]): QueryArgs["where"] {
  const model = Prisma.dmmf.datamodel.models.find(model => model.name.charAt(0).toLowerCase() + model.name.slice(1) === table);
  const normalized = { ...where };
  for (const index of model?.uniqueIndexes ?? []) {
    const key = index.name ?? index.fields.join("_");
    const value = normalized[key];
    if (isRecord(value)) {
      delete normalized[key];
      for (const member of index.fields) {
        normalized[member] = value[member];
      }
    }
  }
  return normalized;
}

export class InMemoryDelegate {
  private rows: TestRow[] = []

  constructor(
    private readonly createDefaults: Record<string, unknown> = {},
    private readonly readRelations: (row: TestRow, args: QueryArgs) => TestRow = row => row,
    private readonly onDelete: (rows: TestRow[]) => Promise<void> = async () => {},
    private readonly normalizeWrite: (row: TestRow) => TestRow = row => row,
    private readonly normalizeUniqueWhere: (where: QueryArgs["where"]) => QueryArgs["where"] = where => where,
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
    return this.findFirst({ ...args, where: this.normalizeUniqueWhere(args.where) })
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
    this.rows[index] = this.normalizeWrite(applyScalarUpdates(this.rows[index]!, args.data))
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
      return this.normalizeWrite(applyScalarUpdates(row, args.data))
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

  reset(seed: Seed = {}) {
    for (const delegate of this.delegates.values()) {
      delegate.reset([])
    }
    for (const [tableName, rows] of Object.entries(seed)) {
      this.getDelegate(tableName).reset(rows)
    }
  }

  snapshot(tableName: string) {
    return this.getDelegate(tableName).snapshot()
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
        row => normalizePrismaScalars(prismaDelegateName, row),
        where => normalizePrismaUniqueWhere(prismaDelegateName, where),
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
