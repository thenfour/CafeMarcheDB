import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import db3Mutation from "tests/authorization/db3MutationTestResolver"
import { getVerifiedGoogleProfileEmail } from "src/auth/server/googleProfile"
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
      calendarFeedToken: "calendar-secret",
    }),
    signInMethods: [{ id: 1, type: "google", identifier: "google-subject-1" }],
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
    ["signInMethods", [{ type: "google", identifier: "attacker-google-subject" }]],
    ["hashedPassword", "attacker-password-hash"],
    ["calendarFeedToken", "attacker-calendar-token"],
    ["accessToken", "attacker-legacy-calendar-token"],
    ["uid", "attacker-server-uid"],
    ["mergedIntoUserId", 1],
    ["mergedAt", new Date("2026-09-14T12:00:00Z")],
  ])("rejects delegated generic writes to authentication field %s", async (field, value) => {
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, { [field]: value }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate User fields: ${field}`)

    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ["signInMethods", [{ type: "google", identifier: "generic-sysadmin-google-subject" }]],
    ["hashedPassword", "generic-sysadmin-password-hash"],
    ["calendarFeedToken", "generic-sysadmin-calendar-token"],
    ["accessToken", "generic-sysadmin-legacy-calendar-token"],
    ["uid", "generic-sysadmin-server-uid"],
    ["mergedIntoUserId", 1],
    ["mergedAt", new Date("2026-09-14T12:00:00Z")],
  ])("keeps authentication field %s out of generic Sysadmin updates", async (field, value) => {
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, { [field]: value }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate User fields: ${field}`)

    expect(update).not.toHaveBeenCalled()
  })
})

describe("BA-U006 verified Google email", () => {
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
