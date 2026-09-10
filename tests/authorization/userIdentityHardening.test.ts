import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import db3Mutation from "@db3/mutations/db3mutations"
import correctUserEmail from "src/auth/mutations/correctUserEmail"
import { getGoogleEmailLinkCandidateWhere, getVerifiedGoogleProfileEmail } from "src/auth/server/googleProfile"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

describe("BA-U006 generic User identity boundaries", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const target = {
    ...createAuthorizationTestUser("normal", {
      id: 10,
      email: "original@test.invalid",
      accessToken: "calendar-secret",
    }),
    googleId: "google-subject-1",
    hashedPassword: "password-hash",
    uid: "server-owned-uid",
  }

  beforeEach(() => {
    authorizationTestDb.reset({
      user: [sysadmin, bandAdmin, target],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("rejects delegated generic User creation before Prisma create", async () => {
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Insert("User", {
        name: "Forged account",
        email: "forged@test.invalid",
      }),
      ctx,
    )).rejects.toThrow("Not authorized to mutate User fields")

    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("user")).toHaveLength(3)
  })

  it.each([
    ["email", "attacker@test.invalid"],
    ["googleId", "attacker-google-subject"],
    ["hashedPassword", "attacker-password-hash"],
    ["accessToken", "attacker-calendar-token"],
    ["uid", "attacker-server-uid"],
  ])("rejects delegated generic writes to authentication field %s", async (field, value) => {
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, { id: target.id, [field]: value }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate User fields: ${field}`)

    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ["email", "generic-sysadmin@test.invalid"],
    ["googleId", "generic-sysadmin-google-subject"],
    ["hashedPassword", "generic-sysadmin-password-hash"],
    ["accessToken", "generic-sysadmin-calendar-token"],
    ["uid", "generic-sysadmin-server-uid"],
  ])("keeps authentication field %s out of generic Sysadmin updates", async (field, value) => {
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, { id: target.id, [field]: value }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate User fields: ${field}`)

    expect(update).not.toHaveBeenCalled()
  })
})

describe("BA-U006 actual-Sysadmin email correction", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const roleGrantedSysadmin = createAuthorizationTestUser("normal", {
    id: 3,
    isSysAdmin: false,
    permissions: [Permission.login, Permission.basic_trust, Permission.sysadmin],
  })
  const target = {
    ...createAuthorizationTestUser("normal", {
      id: 10,
      email: "original@test.invalid",
    }),
    googleId: "existing-google-subject",
  }

  beforeEach(() => {
    authorizationTestDb.reset({
      user: [sysadmin, bandAdmin, roleGrantedSysadmin, target],
      session: [
        { id: 100, userId: target.id },
        { id: 101, userId: sysadmin.id },
      ],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("normalizes the corrected email, preserves Google binding, revokes sessions, and redacts audit values", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(correctUserEmail, {
      userId: target.id,
      email: "  Corrected@Example.COM  ",
    }, ctx)

    expect(result).toEqual({ userId: target.id, email: "corrected@example.com" })
    expect(authorizationTestDb.snapshot("user")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: target.id,
        email: "corrected@example.com",
        googleId: target.googleId,
      }),
    ]))
    expect(authorizationTestDb.snapshot("session")).toEqual([
      expect.objectContaining({ id: 101, userId: sysadmin.id }),
    ])

    const changes = authorizationTestDb.snapshot("change")
    expect(changes).toEqual([
      expect.objectContaining({
        table: "User",
        recordId: target.id,
        action: "update",
        context: "correctUserEmail",
        userId: sysadmin.id,
        oldValues: JSON.stringify({ loginEmailChanged: false }),
        newValues: JSON.stringify({ loginEmailChanged: true }),
      }),
    ])
    expect(JSON.stringify(changes)).not.toContain(target.email)
    expect(JSON.stringify(changes)).not.toContain("corrected@example.com")
  })

  it("does not let Band Admin invoke the correction operation", async () => {
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(invokeResolver(correctUserEmail, {
      userId: target.id,
      email: "attacker@test.invalid",
    }, ctx)).rejects.toThrow("Unauthorized test persona; required: sysadmin")

    expect(update).not.toHaveBeenCalled()
  })

  it("rejects a role-carried sysadmin grant before target lookup", async () => {
    const findFirst = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("normal", {
      id: roleGrantedSysadmin.id,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.basic_trust, Permission.sysadmin],
    })

    await expect(invokeResolver(correctUserEmail, {
      userId: target.id,
      email: "attacker@test.invalid",
    }, ctx)).rejects.toThrow("This operation requires an actual Sysadmin account")

    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst).toHaveBeenCalledWith({
      select: { isSysAdmin: true },
      where: { id: roleGrantedSysadmin.id },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("rejects correction of a deactivated account", async () => {
    authorizationTestDb.reset({
      user: [sysadmin, { ...target, isDeleted: true }],
      session: [{ id: 100, userId: target.id }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(correctUserEmail, {
      userId: target.id,
      email: "corrected@test.invalid",
    }, ctx)).rejects.toThrow("Not authorized to correctEmail this user")

    expect(authorizationTestDb.snapshot("session")).toEqual([
      expect.objectContaining({ id: 100, userId: target.id }),
    ])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})

describe("BA-U006 verified Google email", () => {
  it("limits email fallback to an active account without an existing Google link", () => {
    expect(getGoogleEmailLinkCandidateWhere("verified@example.com")).toEqual({
      AND: [
        { email: "verified@example.com" },
        { googleId: null },
        { isDeleted: false },
      ],
    })
  })

  it("normalizes a verified provider email", () => {
    expect(getVerifiedGoogleProfileEmail({
      emails: [{ value: "  Verified@Example.COM ", verified: true }],
    })).toBe("verified@example.com")
  })

  it.each([
    { emails: [{ value: "unverified@example.com", verified: false }] },
    { emails: [{ value: "missing-claim@example.com" }] },
    { emails: [] },
    {},
  ])("fails closed without a verified provider email", (profile) => {
    expect(getVerifiedGoogleProfileEmail(profile)).toBeNull()
  })

  it("ignores an unverified address when a verified address is also present", () => {
    expect(getVerifiedGoogleProfileEmail({
      emails: [
        { value: "unverified@example.com", verified: false },
        { value: "verified@example.com", verified: true },
      ],
    })).toBe("verified@example.com")
  })
})
