type TestRow = {
  id: number
  [key: string]: unknown
}

type Seed = Record<string, TestRow[]>

const clone = <T>(value: T): T => structuredClone(value)

function matchesScalar(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const expression = expected as Record<string, unknown>
    if ("equals" in expression) return actual === expression.equals
    if ("in" in expression) return (expression.in as unknown[]).includes(actual)
    if ("not" in expression) return !matchesScalar(actual, expression.not)
  }
  return actual === expected
}

function matchesWhere(row: TestRow, where: Record<string, unknown> | undefined): boolean {
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
    return matchesScalar(row[field], expected)
  })
}

export class InMemoryDelegate {
  private rows: TestRow[] = []

  reset(rows: TestRow[]) {
    this.rows = clone(rows)
  }

  snapshot() {
    return clone(this.rows)
  }

  async findFirst(args: { where?: Record<string, unknown> } = {}) {
    const row = this.rows.find((candidate) => matchesWhere(candidate, args.where))
    return row ? clone(row) : null
  }

  async findMany(args: { where?: Record<string, unknown>; take?: number } = {}) {
    const matches = this.rows.filter((candidate) => matchesWhere(candidate, args.where))
    return clone(args.take === undefined ? matches : matches.slice(0, args.take))
  }

  async count(args: { where?: Record<string, unknown> } = {}) {
    return this.rows.filter((candidate) => matchesWhere(candidate, args.where)).length
  }

  async create(args: { data: Omit<TestRow, "id"> & Partial<Pick<TestRow, "id">> }) {
    const nextId = this.rows.reduce((highest, row) => Math.max(highest, row.id), 0) + 1
    const row = { id: args.data.id ?? nextId, ...clone(args.data) } as TestRow
    this.rows.push(row)
    return clone(row)
  }

  async update(args: { where: { id: number }; data: Record<string, unknown> }) {
    const index = this.rows.findIndex((row) => row.id === args.where.id)
    if (index < 0) throw new Error(`In-memory row ${args.where.id} was not found`)
    this.rows[index] = { ...this.rows[index], ...clone(args.data) } as TestRow
    return clone(this.rows[index])
  }

  async updateMany(args: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
    let count = 0
    this.rows = this.rows.map((row) => {
      if (!matchesWhere(row, args.where)) return row
      count += 1
      return { ...row, ...clone(args.data) }
    })
    return { count }
  }

  async deleteMany(args: { where?: Record<string, unknown> } = {}) {
    const retained = this.rows.filter((row) => !matchesWhere(row, args.where))
    const count = this.rows.length - retained.length
    this.rows = retained
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

  getDelegate(tableName: string) {
    const prismaDelegateName = `${tableName.charAt(0).toLowerCase()}${tableName.slice(1)}`
    let delegate = this.delegates.get(prismaDelegateName)
    if (!delegate) {
      delegate = new InMemoryDelegate()
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
  get(target, property, receiver) {
    if (typeof property !== "string") return Reflect.get(target, property, target)
    if (property === "$transaction") {
      return async (callback: (transaction: typeof receiver) => Promise<unknown>) => callback(receiver)
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
