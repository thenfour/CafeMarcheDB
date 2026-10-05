import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

vi.mock("src/server/brand", () => ({
  clearBrandCache: vi.fn(),
}))

import updateBulkSettings from "@/src/setting/server/mutations/updateBulkSettings"
import updateSetting from "@/src/setting/server/mutations/updateSetting"
import * as db3 from "@db3/db3"
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries"
import db3Query from "@db3/queries/db3queries"
import { Permission, getPermissionDefinition } from "shared/permissions"
import setShowingAdminControls from "src/auth/mutations/setShowingAdminControls"
import { clearBrandCache } from "src/server/brand"
import db3Mutation from "tests/authorization/db3MutationTestResolver"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3PublicUpdate, forgeDb3Query } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const brandingPermissionSet = [
  Permission.login,
  Permission.manage_site_branding,
]

const brandManager = createAuthorizationTestUser("normal", {
  id: 701,
  permissions: brandingPermissionSet,
})
const sysadmin = createAuthorizationTestUser("sysadmin", { id: 702 })

describe("BA-C001 and BA-C002 setting authorization", () => {
  beforeEach(() => {
    authorizationTestDb.reset({
      user: [brandManager, sysadmin],
      setting: [],
      change: [],
    })
    vi.mocked(clearBrandCache).mockClear()
  })

  it("registers site branding as a delegable site capability", () => {
    expect(getPermissionDefinition(Permission.manage_site_branding)).toEqual(
      expect.objectContaining({
        scope: "site",
        isDelegable: true,
        isProtected: false,
      }),
    )
  })

  it("accepts a freshly verified role-carried Sysadmin permission", async () => {
    const roleGrantedSysadmin = createAuthorizationTestUser("normal", {
      id: 703,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.sysadmin],
    })
    authorizationTestDb.reset({
      user: [roleGrantedSysadmin],
      setting: [{ id: 1, publicId: "SettingPublic001", name: "technical_setting", value: "before" }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: roleGrantedSysadmin.id,
      permissions: [Permission.login, Permission.sysadmin],
    })

    const updated = await invokeResolver(
      updateSetting,
      { name: "technical_setting", value: "forged" },
      ctx,
    )
    expect(updated).toEqual(expect.objectContaining({ publicId: "SettingPublic001", value: "forged" }))
    expect(updated).not.toHaveProperty("id")
    await expect(invokeResolver(
      updateBulkSettings,
      [{ name: "technical_setting", value: "forged" }],
      ctx,
    )).resolves.toBeUndefined()
    const page = await invokeResolver(
      db3PaginatedQuery,
      {
        ...forgeDb3Query("Setting", {
          table: { tableID: "Setting", tableName: "Setting", viewID: db3.settingEditorView.viewID },
        }),
        skip: 0,
        take: 1000,
      },
      ctx,
    )
    expect(page.items[0]).toEqual(expect.objectContaining({ publicId: "SettingPublic001", value: "forged" }))
    expect(page.items[0]).not.toHaveProperty("id")
    await expect(invokeResolver(
      setShowingAdminControls,
      { showAdminControls: true },
      ctx,
    )).resolves.toBeUndefined()
    await expect(invokeResolver(db3Query, forgeDb3Query("Setting"), ctx)).resolves.toBeDefined()
    await expect(invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("Setting", "SettingPublic001", {
        name: "technical_setting",
        value: "forged",
      }),
      ctx,
    )).resolves.toBeDefined()
    expect(authorizationTestDb.snapshot("setting")).toEqual([
      expect.objectContaining({ id: 1, name: "technical_setting", value: "forged" }),
    ])
    expect(clearBrandCache).toHaveBeenCalled()
  })

  it("allows a Sysadmin to use generic setting administration", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await invokeResolver(updateSetting, { name: "technical_setting", value: "after" }, ctx)

    expect(authorizationTestDb.snapshot("setting")).toEqual([
      expect.objectContaining({ publicId: expect.any(String), name: "technical_setting", value: "after" }),
    ])
    expect(clearBrandCache).toHaveBeenCalledTimes(1)
  })

  it("marks the raw Setting DB3 schema as Sysadmin-permission-only", () => {
    expect(db3.xSetting.tableAuthMap).toEqual({
      ViewOwn: Permission.sysadmin,
      View: Permission.sysadmin,
      EditOwn: Permission.sysadmin,
      Edit: Permission.sysadmin,
      Insert: Permission.sysadmin,
    })
  })
})
