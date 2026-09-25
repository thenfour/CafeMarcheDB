import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PermissionSet } from "src/auth/shared/PermissionSet"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import * as db3 from "@db3/db3"
import { GetAuthorizedTableReadWhere } from "@db3/server/db3ReadPolicy"
import { SqlCombineAndExpression } from "shared/mysqlUtils"
import { gPermissionOrdered, Permission } from "shared/permissions"
import {
  createAuthorizationSchemaData,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb, matchesWhere } from "./support/inMemoryPrisma"

const emptyFilter = { items: [], tableParams: {} }
const registeredTables = Object.values(db3.gAllTables)
const softDeleteTables = registeredTables.filter(table => !!table.SqlSpecialColumns.isDeleted)
const visibilityTables = registeredTables.filter(table => !!table.SqlSpecialColumns.visiblePermission)
const policyTables = registeredTables.filter(table => (
  !!table.SqlSpecialColumns.isDeleted || !!table.SqlSpecialColumns.visiblePermission
))

const actor = createAuthorizationTestUser("normal", {
  id: 501,
  permissions: gPermissionOrdered,
})
const actorPublicData = createAuthorizationSchemaData(actor)
const grantedVisibilityId = actor.role!.permissions.find(
  entry => entry.permission.name === Permission.visibility_public,
)!.permissionId

function makePolicyRow(
  table: db3.xTable,
  overrides: Record<string, unknown> = {},
): { id: number; [key: string]: unknown } {
  const row: Record<string, unknown> = { id: 1 }
  const deletedColumn = table.SqlSpecialColumns.isDeleted
  const visibilityColumn = table.SqlSpecialColumns.visiblePermission
  const ownerColumn = table.SqlSpecialColumns.ownerUser
  if (deletedColumn) row[deletedColumn.member] = false
  if (visibilityColumn) row[visibilityColumn.fkidMember!] = grantedVisibilityId
  if (ownerColumn) row[ownerColumn.fkidMember || ownerColumn.member] = actor.id + 1
  return { ...row, ...overrides } as { id: number; [key: string]: unknown }
}

describe("schema-wide DB3 read-policy contracts", () => {
  it("registers DB3 policy metadata for every protected Prisma model", () => {
    const protectedModels = Prisma.dmmf.datamodel.models.filter(model => (
      model.fields.some(field => field.name === "isDeleted")
      || model.fields.some(field => field.name === "visiblePermissionId")
    ))

    for (const model of protectedModels) {
      const tables = registeredTables.filter(table => table.tableName === model.name)
      expect(tables.length, `${model.name} has no registered DB3 descriptor`).toBeGreaterThan(0)

      for (const table of tables) {
        if (model.fields.some(field => field.name === "isDeleted")) {
          expect(table.SqlSpecialColumns.isDeleted, `${table.tableID} omits isDeleted`).toBeTruthy()
          expect(table.SqlSpecialColumns.isDeleted!.member).toBe("isDeleted")
        }
        if (model.fields.some(field => field.name === "visiblePermissionId")) {
          expect(table.SqlSpecialColumns.visiblePermission, `${table.tableID} omits visibility`).toBeTruthy()
          expect(table.SqlSpecialColumns.ownerUser, `${table.tableID} omits private-row ownership`).toBeTruthy()
          expect(table.SqlSpecialColumns.visiblePermission!.fkidMember).toBe("visiblePermissionId")
          const ownerMember = table.SqlSpecialColumns.ownerUser!.fkidMember
            || table.SqlSpecialColumns.ownerUser!.member
          expect(
            model.fields.some(field => field.name === ownerMember),
            `${table.tableID} owner field ${ownerMember} is not in Prisma`,
          ).toBe(true)
        }
      }
    }
  })

  it.each(softDeleteTables.map(table => [table.tableID, table] as const))(
    "%s excludes deleted rows for an ordinary query",
    (_tableId, table) => {
      const where = table.CalculateWhereClause({
        filterModel: emptyFilter,
        publicData: actorPublicData,
      })
      const deletedColumn = table.SqlSpecialColumns.isDeleted!

      expect(matchesWhere(makePolicyRow(table), where as any)).toBe(true)
      expect(matchesWhere(makePolicyRow(table, { [deletedColumn.member]: true }), where as any)).toBe(false)
    },
  )

  it.each(visibilityTables.map(table => [table.tableID, table] as const))(
    "%s enforces granted, denied, private-owner, and private-non-owner visibility",
    (_tableId, table) => {
      const where = table.CalculateWhereClause({
        filterModel: emptyFilter,
        publicData: actorPublicData,
      })
      const visibilityColumn = table.SqlSpecialColumns.visiblePermission!
      const ownerColumn = table.SqlSpecialColumns.ownerUser!
      const ownerMember = ownerColumn.fkidMember || ownerColumn.member

      expect(matchesWhere(makePolicyRow(table), where as any)).toBe(true)
      expect(matchesWhere(makePolicyRow(table, {
        [visibilityColumn.fkidMember!]: 999_999,
      }), where as any)).toBe(false)
      expect(matchesWhere(makePolicyRow(table, {
        [visibilityColumn.fkidMember!]: null,
        [ownerMember]: actor.id,
      }), where as any)).toBe(true)
      expect(matchesWhere(makePolicyRow(table, {
        [visibilityColumn.fkidMember!]: null,
        [ownerMember]: actor.id + 1,
      }), where as any)).toBe(false)
    },
  )

  it.each(visibilityTables.map(table => [table.tableID, table] as const))(
    "%s keeps private ownership inside an independent primary-key scope",
    (_tableId, table) => {
      const where = table.CalculateWhereClause({
        filterModel: { ...emptyFilter, pks: [1] },
        publicData: actorPublicData,
      })
      const visibilityColumn = table.SqlSpecialColumns.visiblePermission!
      const ownerColumn = table.SqlSpecialColumns.ownerUser!
      const privateOwner = {
        [visibilityColumn.fkidMember!]: null,
        [ownerColumn.fkidMember || ownerColumn.member]: actor.id,
      }

      expect(matchesWhere(makePolicyRow(table, { id: 1, ...privateOwner }), where as any)).toBe(true)
      expect(matchesWhere(makePolicyRow(table, { id: 2, ...privateOwner }), where as any)).toBe(false)
    },
  )

  it("uses only the public role's visibility permissions for anonymous queries", () => {
    const publicVisibilityId = 7_001
    authorizationTestDb.reset({
      role: [{
        id: 90,
        isPublicRole: true,
        permissions: [{ permissionId: publicVisibilityId }],
      }],
    })
    const publicAuthorization = createAuthorizationSchemaData(null)
    const publicData = { ...publicAuthorization, effectivePermissions: new PermissionSet(
      publicAuthorization.effectivePermissions.names.map((name, index) => ({
        id: name === Permission.visibility_public ? publicVisibilityId : 920_000 + index, name,
      })),
    ) }

    for (const table of visibilityTables) {
      const where = table.CalculateWhereClause({
        filterModel: emptyFilter,
        publicData,
      })
      const visibilityColumn = table.SqlSpecialColumns.visiblePermission!
      const ownerColumn = table.SqlSpecialColumns.ownerUser!

      const publicRowMatches = matchesWhere(makePolicyRow(table, {
        [visibilityColumn.fkidMember!]: publicVisibilityId,
      }), where as any)
      expect(publicRowMatches).toBe(table.authorizeTableForView(publicData))
      expect(matchesWhere(makePolicyRow(table, {
        [visibilityColumn.fkidMember!]: null,
        [ownerColumn.fkidMember || ownerColumn.member]: actor.id,
      }), where as any)).toBe(false)
    }
  })

  it.each(policyTables.map(table => [table.tableID, table] as const))(
    "%s applies row policies to Sysadmins and requires explicit deleted-row access",
    (_tableId, table) => {
      const sysadmin = createAuthorizationTestUser("sysadmin", { id: 601 })
      const publicData = createAuthorizationSchemaData(sysadmin)
      const restrictedWhere = table.CalculateWhereClause({
        filterModel: emptyFilter,
        publicData,
      })
      const recoveryWhere = table.CalculateWhereClause({
        filterModel: emptyFilter,
        publicData,
        includeDeleted: true,
      })
      const hiddenRow = makePolicyRow(table)
      if (table.SqlSpecialColumns.isDeleted) {
        hiddenRow[table.SqlSpecialColumns.isDeleted.member] = true
      }
      if (table.SqlSpecialColumns.visiblePermission) {
        hiddenRow[table.SqlSpecialColumns.visiblePermission.fkidMember!] = 999_999
      }

      expect(matchesWhere(hiddenRow, restrictedWhere as any)).toBe(false)
      expect(matchesWhere(hiddenRow, recoveryWhere as any)).toBe(
        !table.SqlSpecialColumns.visiblePermission && !!table.viewDeletedPermission,
      )
    },
  )
})

describe("read-policy composition boundaries", () => {
  beforeEach(() => authorizationTestDb.reset())

  it("ANDs trusted business predicates with DB3 policy predicates", async () => {
    const where = await GetAuthorizedTableReadWhere({
      table: db3.xEvent,
      currentUser: actor as any,
      where: { id: { in: [11] } },
    })

    expect(matchesWhere(makePolicyRow(db3.xEvent, { id: 11 }), where)).toBe(true)
    expect(matchesWhere(makePolicyRow(db3.xEvent, { id: 12 }), where)).toBe(false)
    expect(matchesWhere(makePolicyRow(db3.xEvent, { id: 11, isDeleted: true }), where)).toBe(false)
  })

  it("awaits visibility filtering for protected relation includes", async () => {
    const selection = await db3.xSong.CalculateSelectionArgs(
      createAuthorizationSchemaData(actor),
      emptyFilter,
      false,
      db3.songSearchView.getSelectionArgs,
    )
    const fileWhere = selection!.select.taggedFiles.where.file
    const visibleFile = makePolicyRow(db3.xFile, { id: 21 })

    expect(matchesWhere(visibleFile, fileWhere)).toBe(true)
    expect(matchesWhere({ ...visibleFile, isDeleted: true }, fileWhere)).toBe(false)
    expect(matchesWhere({ ...visibleFile, visiblePermissionId: 999_999 }, fileWhere)).toBe(false)
  })

  it.each(visibilityTables.map(table => [table.tableID, table] as const))(
    "%s groups the raw-SQL permission/owner OR before composing adjacent predicates",
    (_tableId, table) => {
      const policySql = table.SqlGetVisFilterExpression(actor as any, "P")
      const composedSql = SqlCombineAndExpression(["(P.id = 123)", policySql])
      const visibilityColumn = table.SqlSpecialColumns.visiblePermission!.fkidMember!

      expect(policySql).toContain(`(P.${visibilityColumn} IN (`)
      expect(policySql).toMatch(/^\([\s\S]*\n\s+OR [\s\S]*\)$/)
      expect(composedSql).toContain(`AND ${policySql}`)
    },
  )
})
