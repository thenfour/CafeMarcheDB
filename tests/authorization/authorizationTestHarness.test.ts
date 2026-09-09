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
import db3Query from "@db3/queries/db3queries"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTarget,
  createAuthorizationTestUser,
  type AuthorizationPersona,
  type AuthorizationTargetKind,
} from "./support/authorizationFixtures"
import { forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

describe("authorization test personas", () => {
  const personas: AuthorizationPersona[] = [
    "public",
    "limited",
    "normal",
    "editor",
    "moderator",
    "bandAdmin",
    "sysadmin",
  ]

  it.each(personas)("builds an isolated %s persona", (persona) => {
    const fixture = createAuthorizationPersona(persona)

    expect(fixture.persona).toBe(persona)
    expect(fixture.publicData.userId).toBe(fixture.user?.id ?? 0)
    expect(fixture.publicData.isSysAdmin).toBe(persona === "sysadmin")
    expect(fixture.publicData.permissions).toContain(Permission.visibility_public)
  })

  it("keeps Band Admin distinct from Sysadmin", () => {
    const bandAdmin = createAuthorizationPersona("bandAdmin")

    expect(bandAdmin.publicData.isSysAdmin).toBe(false)
    expect(bandAdmin.publicData.permissions).not.toContain(Permission.sysadmin)
    expect(bandAdmin.publicData.permissions).not.toContain(Permission.impersonate_user)
  })

  const targetKinds: AuthorizationTargetKind[] = [
    "ordinary",
    "peerBandAdmin",
    "protectedRole",
    "isSysAdmin",
  ]

  it.each(targetKinds)("builds a distinct %s target", (targetKind) => {
    const target = createAuthorizationTarget(targetKind)

    expect(target.id).toBeGreaterThan(0)
    expect(target.isSysAdmin).toBe(targetKind === "isSysAdmin")
    expect(target.role?.permissions.some((entry) => entry.permission.name === Permission.sysadmin)).toBe(
      targetKind === "protectedRole",
    )
  })
})

describe("generic DB3 resolver harness", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const target = createAuthorizationTestUser("normal", {
    id: 2,
    name: "Before mutation",
  })

  beforeEach(() => {
    authorizationTestDb.reset({
      user: [sysadmin, target],
      change: [],
    })
  })

  it("invokes a generic query with a caller-forged request", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Query,
      forgeDb3Query("User"),
      ctx,
    )

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sysadmin.id }),
        expect.objectContaining({ id: target.id, name: "Before mutation" }),
      ]),
    )
    expect(authorizationTestDb.snapshot("user")).toHaveLength(2)
  })

  it("invokes a generic mutation and exposes persisted state for assertions", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, {
        id: target.id,
        name: "After mutation",
      }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({ id: target.id, name: "After mutation" }))
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: target.id, name: "After mutation" }),
      ]),
    )
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "User", recordId: target.id, action: "update" }),
      ]),
    )
  })
})
