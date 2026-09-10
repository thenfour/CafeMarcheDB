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
import setRoleDesignation from "src/auth/mutations/setRoleDesignation"
import {
  RoleDesignation,
  type RoleDesignationValue,
} from "src/auth/roleDesignations"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

type RoleFlag = "isRoleForNewUsers" | "isPublicRole"

const makeRole = (id: number, overrides: Partial<Record<RoleFlag, boolean>> = {}) => ({
  id,
  name: `Role ${id}`,
  description: "",
  isRoleForNewUsers: false,
  isPublicRole: false,
  sortOrder: id,
  color: null,
  significance: null,
  permissions: [],
  ...overrides,
})

const assignments: Array<{
  designation: RoleDesignationValue
  flag: RoleFlag
}> = [
  { designation: RoleDesignation.newUsers, flag: "isRoleForNewUsers" },
  { designation: RoleDesignation.public, flag: "isPublicRole" },
]

describe("BA-U005 built-in role designations", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.each(assignments)("atomically repairs duplicate $designation assignments", async ({
    designation,
    flag,
  }) => {
    const roles = [
      makeRole(10, { [flag]: true }),
      makeRole(11, { [flag]: true }),
      makeRole(12),
    ]
    authorizationTestDb.reset({ user: [sysadmin], role: roles, change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(setRoleDesignation, {
      designation,
      roleId: 12,
    }, ctx)).resolves.toEqual({ designation, roleId: 12 })

    const resultingRoles = authorizationTestDb.snapshot("role")
    expect(resultingRoles.filter(role => role[flag])).toEqual([
      expect.objectContaining({ id: 12 }),
    ])

    const changes = authorizationTestDb.snapshot("change")
    expect(changes).toHaveLength(3)
    expect(new Set(changes.map(change => change.operationId)).size).toBe(1)
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "Role",
        recordId: 10,
        context: "setRoleDesignation",
        oldValues: JSON.stringify({ [flag]: true }),
        newValues: JSON.stringify({ [flag]: false }),
      }),
      expect.objectContaining({
        table: "Role",
        recordId: 11,
        context: "setRoleDesignation",
        oldValues: JSON.stringify({ [flag]: true }),
        newValues: JSON.stringify({ [flag]: false }),
      }),
      expect.objectContaining({
        table: "Role",
        recordId: 12,
        context: "setRoleDesignation",
        oldValues: JSON.stringify({ [flag]: false }),
        newValues: JSON.stringify({ [flag]: true }),
      }),
    ]))
  })

  it.each(assignments)("repairs a missing $designation assignment", async ({ designation, flag }) => {
    authorizationTestDb.reset({
      user: [sysadmin],
      role: [makeRole(10), makeRole(11)],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await invokeResolver(setRoleDesignation, { designation, roleId: 11 }, ctx)

    expect(authorizationTestDb.snapshot("role").filter(role => role[flag])).toEqual([
      expect.objectContaining({ id: 11 }),
    ])
    expect(authorizationTestDb.snapshot("change")).toHaveLength(1)
  })

  it("does not audit or write an already-valid assignment", async () => {
    const selectedRole = makeRole(10, { isPublicRole: true })
    authorizationTestDb.reset({
      user: [sysadmin],
      role: [selectedRole, makeRole(11)],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const update = vi.spyOn(authorizationTestDb.getDelegate("role"), "update")

    await invokeResolver(setRoleDesignation, {
      designation: RoleDesignation.public,
      roleId: selectedRole.id,
    }, ctx)

    expect(update).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("requires the persisted actual-Sysadmin flag before inspecting roles", async () => {
    const roleCarriedSysadmin = createAuthorizationTestUser("sysadmin", {
      id: 2,
      isSysAdmin: false,
    })
    authorizationTestDb.reset({
      user: [roleCarriedSysadmin],
      role: [makeRole(10, { isPublicRole: true })],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", {
      id: roleCarriedSysadmin.id,
      isSysAdmin: false,
    })
    const findRoles = vi.spyOn(authorizationTestDb.getDelegate("role"), "findMany")

    await expect(invokeResolver(setRoleDesignation, {
      designation: RoleDesignation.public,
      roleId: 10,
    }, ctx)).rejects.toThrow("requires an actual Sysadmin")

    expect(findRoles).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("rejects an unknown selected role without changing assignments", async () => {
    const roles = [makeRole(10, { isRoleForNewUsers: true }), makeRole(11)]
    authorizationTestDb.reset({ user: [sysadmin], role: roles, change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(setRoleDesignation, {
      designation: RoleDesignation.newUsers,
      roleId: 999,
    }, ctx)).rejects.toThrow()

    expect(authorizationTestDb.snapshot("role")).toEqual(roles)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it.each(assignments)("rejects generic updates to $flag, including from Sysadmin", async ({ flag }) => {
    const selectedRole = makeRole(10, { [flag]: true })
    authorizationTestDb.reset({
      user: [sysadmin],
      role: [selectedRole, makeRole(11)],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const update = vi.spyOn(authorizationTestDb.getDelegate("role"), "update")

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("Role", selectedRole.id, { [flag]: false }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate Role fields: ${flag}`)

    expect(update).not.toHaveBeenCalled()
  })

  it("allows generic creation of an unassigned ordinary role", async () => {
    authorizationTestDb.reset({ user: [sysadmin], role: [], change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Insert("Role", {
        name: "Ordinary role",
        isRoleForNewUsers: false,
        isPublicRole: false,
      }),
      ctx,
    )).resolves.toEqual(expect.objectContaining({
      name: "Ordinary role",
      isRoleForNewUsers: false,
      isPublicRole: false,
    }))
  })

  it.each(assignments)("rejects generic creation with $flag assigned", async ({ flag }) => {
    authorizationTestDb.reset({ user: [sysadmin], role: [], change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Insert("Role", {
        name: "Forged built-in role",
        isRoleForNewUsers: false,
        isPublicRole: false,
        [flag]: true,
      }),
      ctx,
    )).rejects.toThrow(`Not authorized to mutate Role fields: ${flag}`)

    expect(authorizationTestDb.snapshot("role")).toEqual([])
  })
})
