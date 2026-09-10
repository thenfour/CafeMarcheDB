import { hash256 } from "@blitzjs/auth"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import claimAdminBootstrap from "src/auth/mutations/claimAdminBootstrap"
import signup from "src/auth/mutations/signup"
import getAdminBootstrapStatus from "src/auth/queries/getAdminBootstrapStatus"
import { GetPublicRole } from "src/core/db3/shared/db3Helpers"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const bootstrapEmail = "recovery-admin@test.invalid"
const bootstrapSecret = "one-time-bootstrap-secret-with-32-characters"
const previousBootstrapEmail = process.env.CMDB_ADMIN_BOOTSTRAP_EMAIL
const previousBootstrapSecret = process.env.CMDB_ADMIN_BOOTSTRAP_SECRET
const previousAdminEmail = process.env.ADMIN_EMAIL

const restoreEnvironmentVariable = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe("BA-U005 administrator bootstrap", () => {
  beforeEach(() => {
    process.env.CMDB_ADMIN_BOOTSTRAP_EMAIL = bootstrapEmail
    process.env.CMDB_ADMIN_BOOTSTRAP_SECRET = bootstrapSecret
    process.env.ADMIN_EMAIL = bootstrapEmail
    vi.restoreAllMocks()
  })

  afterEach(() => {
    restoreEnvironmentVariable("CMDB_ADMIN_BOOTSTRAP_EMAIL", previousBootstrapEmail)
    restoreEnvironmentVariable("CMDB_ADMIN_BOOTSTRAP_SECRET", previousBootstrapSecret)
    restoreEnvironmentVariable("ADMIN_EMAIL", previousAdminEmail)
  })

  it("ignores privileged fields supplied to ordinary signup and never uses ADMIN_EMAIL", async () => {
    authorizationTestDb.reset({
      role: [{ id: 10, isRoleForNewUsers: true }],
      user: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("public")
    const createSession = vi.fn(async () => undefined)
    ctx.session.$create = createSession

    const result = await invokeResolver(signup, {
      email: bootstrapEmail,
      name: "Recovery user",
      password: "valid password",
      roleId: 999,
      googleId: "attacker-controlled-google-id",
      isSysAdmin: true,
    } as never, ctx)

    expect(result).toEqual({ id: 1, name: "Recovery user", email: bootstrapEmail })
    expect(authorizationTestDb.snapshot("user")).toEqual([
      expect.objectContaining({
        id: 1,
        email: bootstrapEmail,
        roleId: 10,
        isSysAdmin: false,
      }),
    ])
    expect(authorizationTestDb.snapshot("user")[0]).not.toHaveProperty("googleId", "attacker-controlled-google-id")
    const signupChange = authorizationTestDb.snapshot("change")[0]!
    expect(signupChange).toEqual(expect.objectContaining({ table: "User" }))
    expect(JSON.parse(signupChange.newValues as string)).toEqual({
      name: "Recovery user",
      email: bootstrapEmail,
      isSysAdmin: false,
      roleId: 10,
      authenticationMethod: "password",
    })
    expect(createSession).toHaveBeenCalledOnce()
  })

  it.each([
    ["missing", []],
    ["duplicated", [
      { id: 10, isRoleForNewUsers: true },
      { id: 11, isRoleForNewUsers: true },
    ]],
  ])("fails signup closed when the default role is %s", async (_case, roles) => {
    authorizationTestDb.reset({ role: roles, user: [], change: [] })
    const { ctx } = createAuthorizationPersona("public")

    await expect(invokeResolver(signup, {
      email: "new-user@test.invalid",
      name: "New user",
      password: "valid password",
    }, ctx)).rejects.toThrow(/Expected exactly one role for new users/)

    expect(authorizationTestDb.snapshot("user")).toEqual([])
  })

  it.each([
    ["missing", []],
    ["duplicated", [
      { id: 20, isPublicRole: true, permissions: [] },
      { id: 21, isPublicRole: true, permissions: [] },
    ]],
  ])("fails public-role lookup closed when the role is %s", async (_case, roles) => {
    authorizationTestDb.reset({ role: roles })

    await expect(GetPublicRole()).rejects.toThrow(/Expected exactly one public role/)
  })

  it("requires an authenticated account before bootstrap lookup or claim", async () => {
    authorizationTestDb.reset({ user: [], adminBootstrapClaim: [], change: [] })
    const { ctx } = createAuthorizationPersona("public")
    const findUser = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")

    await expect(invokeResolver(getAdminBootstrapStatus, null, ctx)).rejects.toThrow("Unauthorized")
    await expect(invokeResolver(claimAdminBootstrap, {
      secret: bootstrapSecret,
    }, ctx)).rejects.toThrow("Unauthorized")

    expect(findUser).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([])
  })

  it("does not disclose bootstrap status to a different authenticated email", async () => {
    const actor = createAuthorizationTestUser("normal", {
      id: 1,
      email: "someone-else@test.invalid",
    })
    authorizationTestDb.reset({ user: [actor], adminBootstrapClaim: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })

    await expect(invokeResolver(getAdminBootstrapStatus, null, ctx)).resolves.toEqual({
      isEligible: false,
      isConfigured: false,
      isClaimable: false,
      isAlreadySysadmin: false,
    })
  })

  it("reports an unused credential only to the matching active user", async () => {
    const actor = createAuthorizationTestUser("normal", { id: 1, email: bootstrapEmail })
    authorizationTestDb.reset({ user: [actor], adminBootstrapClaim: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })

    await expect(invokeResolver(getAdminBootstrapStatus, null, ctx)).resolves.toEqual({
      isEligible: true,
      isConfigured: true,
      isClaimable: true,
      isAlreadySysadmin: false,
    })
  })

  it("rejects a wrong credential without mutating the user or claim history", async () => {
    const actor = createAuthorizationTestUser("normal", { id: 1, email: bootstrapEmail })
    authorizationTestDb.reset({ user: [actor], adminBootstrapClaim: [], session: [], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })

    await expect(invokeResolver(claimAdminBootstrap, {
      secret: "wrong-bootstrap-secret-that-is-long-enough",
    }, ctx)).rejects.toThrow("Administrator bootstrap is unavailable")

    expect(authorizationTestDb.snapshot("user")[0]).toEqual(expect.objectContaining({ isSysAdmin: false }))
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("rechecks the database email and refuses a stale matching session", async () => {
    const actor = createAuthorizationTestUser("normal", {
      id: 1,
      email: "changed-address@test.invalid",
    })
    authorizationTestDb.reset({ user: [actor], adminBootstrapClaim: [], session: [], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: bootstrapEmail,
    })

    await expect(invokeResolver(claimAdminBootstrap, {
      secret: bootstrapSecret,
    }, ctx)).rejects.toThrow("Administrator bootstrap is unavailable")

    expect(authorizationTestDb.snapshot("user")[0]).toEqual(expect.objectContaining({ isSysAdmin: false }))
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([])
  })

  it("refuses a deleted matching database account", async () => {
    const actor = createAuthorizationTestUser("normal", {
      id: 1,
      email: bootstrapEmail,
      isDeleted: true,
    })
    authorizationTestDb.reset({ user: [actor], adminBootstrapClaim: [], session: [], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })

    await expect(invokeResolver(getAdminBootstrapStatus, null, ctx)).resolves.toEqual({
      isEligible: false,
      isConfigured: false,
      isClaimable: false,
      isAlreadySysadmin: false,
    })
    await expect(invokeResolver(claimAdminBootstrap, {
      secret: bootstrapSecret,
    }, ctx)).rejects.toThrow("Administrator bootstrap is unavailable")

    expect(authorizationTestDb.snapshot("user")[0]).toEqual(expect.objectContaining({ isSysAdmin: false }))
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([])
  })

  it("atomically records the secret hash, grants Sysadmin, audits, and refreshes the session", async () => {
    const actor = createAuthorizationTestUser("normal", { id: 1, email: bootstrapEmail })
    authorizationTestDb.reset({
      user: [actor],
      adminBootstrapClaim: [],
      session: [{ id: 1, userId: actor.id, handle: "old-session" }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })
    const createSession = vi.fn(async () => undefined)
    ctx.session.$create = createSession

    await expect(invokeResolver(claimAdminBootstrap, {
      secret: bootstrapSecret,
    }, ctx)).resolves.toEqual({ userId: actor.id, isSysAdmin: true })

    expect(authorizationTestDb.snapshot("user")[0]).toEqual(expect.objectContaining({ isSysAdmin: true }))
    expect(authorizationTestDb.snapshot("session")).toEqual([])
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([
      expect.objectContaining({
        tokenHash: hash256(bootstrapSecret),
        claimedByUserId: actor.id,
      }),
    ])
    expect(JSON.stringify(authorizationTestDb.snapshot("adminBootstrapClaim"))).not.toContain(bootstrapSecret)
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({
        table: "User",
        recordId: actor.id,
        context: "claimAdminBootstrap",
        oldValues: JSON.stringify({ isSysAdmin: false }),
        newValues: JSON.stringify({ isSysAdmin: true }),
      }),
    ])
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: actor.id,
      isSysAdmin: true,
    }))
  })

  it("cannot reuse a claimed credential", async () => {
    const actor = createAuthorizationTestUser("normal", { id: 1, email: bootstrapEmail })
    authorizationTestDb.reset({
      user: [actor],
      adminBootstrapClaim: [{
        id: 1,
        tokenHash: hash256(bootstrapSecret),
        claimedByUserId: 99,
        claimedAt: new Date(),
      }],
      session: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      email: actor.email,
    })

    await expect(invokeResolver(claimAdminBootstrap, {
      secret: bootstrapSecret,
    }, ctx)).rejects.toThrow("Administrator bootstrap is unavailable")

    expect(authorizationTestDb.snapshot("user")[0]).toEqual(expect.objectContaining({ isSysAdmin: false }))
    expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toHaveLength(1)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})
