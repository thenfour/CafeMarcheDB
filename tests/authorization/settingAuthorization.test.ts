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

import * as db3 from "@db3/db3"
import db3Mutation from "tests/authorization/db3MutationTestResolver"
import db3Query from "@db3/queries/db3queries"
import setShowingAdminControls from "src/auth/mutations/setShowingAdminControls"
import updateBulkSettings from "src/auth/mutations/updateBulkSettings"
import updateSetting from "src/auth/mutations/updateSetting"
import updateSiteBrandingSettings from "src/auth/mutations/updateSiteBrandingSettings"
import getPaginatedSettings from "src/auth/queries/getPaginatedSettings"
import getSetting from "src/auth/queries/getSetting"
import getSiteBrandingSettings from "src/auth/queries/getSiteBrandingSettings"
import { clearBrandCache } from "src/server/brand"
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy"
import { Permission, getPermissionDefinition } from "shared/permissions"
import { Setting } from "shared/settingKeys"
import {
  type SiteBrandingSettings,
  siteBrandingSettingNames,
  siteBrandingSettingsFromValues,
} from "shared/siteBranding"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders"
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

const validBranding = (): SiteBrandingSettings => ({
  ...siteBrandingSettingsFromValues(new Map()),
  siteFaviconUrl: "/favicon.png",
  themePrimaryMain: "#344873",
  themeSecondaryMain: "#831012",
  themeBackgroundDefault: "#fafafa",
  themeBackgroundPaper: "#ffffff",
  themeContrastText: "#ede331",
})

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

  it("keeps the branding aggregate limited to the intended setting names", () => {
    expect(siteBrandingSettingNames).toEqual([
      Setting.Dashboard_SiteTitle,
      Setting.Dashboard_SiteTitlePrefix,
      Setting.Dashboard_SiteFaviconUrl,
      Setting.Dashboard_SiteLogoUrl,
      Setting.BandTimeZone,
      Setting.Ical_CalendarName,
      Setting.Ical_CalendarCompany,
      Setting.Ical_CalendarProduct,
      Setting.Ical_CalendarEventPrefix,
      Setting.Dashboard_Theme_PrimaryMain,
      Setting.Dashboard_Theme_SecondaryMain,
      Setting.Dashboard_Theme_BackgroundDefault,
      Setting.Dashboard_Theme_BackgroundPaper,
      Setting.Dashboard_Theme_TextPrimary,
      Setting.Dashboard_Theme_ContrastText,
    ])
    expect(siteBrandingSettingNames).not.toContain(Setting.Dashboard_HostingMode)
  })

  it("allows a freshly authorized brand manager to update only the branding aggregate", async () => {
    const { ctx } = createAuthorizationPersona("normal", {
      id: brandManager.id,
      permissions: brandingPermissionSet,
    })
    const input = {
      ...validBranding(),
      siteTitle: "The Example Band",
      calendarName: "Example Band calendar",
      bandTimeZone: "Asia/Tokyo",
      themePrimaryMain: "#123456",
    }

    await expect(invokeResolver(updateSiteBrandingSettings, input, ctx)).resolves.toEqual(input)

    expect(authorizationTestDb.snapshot("setting")).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: Setting.Dashboard_SiteTitle, value: input.siteTitle }),
      expect.objectContaining({ name: Setting.Ical_CalendarName, value: input.calendarName }),
      expect.objectContaining({ name: Setting.BandTimeZone, value: input.bandTimeZone }),
      expect.objectContaining({ name: Setting.Dashboard_Theme_PrimaryMain, value: input.themePrimaryMain }),
    ]))
    expect(authorizationTestDb.snapshot("setting")).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: Setting.Dashboard_HostingMode }),
    ]))
    expect(clearBrandCache).toHaveBeenCalledTimes(1)
    await expect(invokeResolver(getSiteBrandingSettings, {}, ctx)).resolves.toEqual(input)
  })

  it.each([undefined, "", "   "])("defaults an unset band time zone (%s) without writing settings", async value => {
    if (value !== undefined) {
      authorizationTestDb.getDelegate("setting").reset([
        { id: 1, name: Setting.BandTimeZone, value },
      ])
    }
    const before = authorizationTestDb.snapshot("setting")
    const { ctx } = createAuthorizationPersona("public")

    await expect(invokeResolver(getSiteBrandingSettings, {}, ctx)).resolves.toEqual(
      expect.objectContaining({ bandTimeZone: DEFAULT_BAND_TIME_ZONE }),
    )
    expect(authorizationTestDb.snapshot("setting")).toEqual(before)
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it.each(["", "   ", "Europe/NotAPlace", "+02:00"])("rejects invalid band time zone %s before changing any branding", async bandTimeZone => {
    const initialSettings = [
      { id: 1, name: Setting.Dashboard_SiteTitle, value: "Original title" },
      { id: 2, name: Setting.BandTimeZone, value: "Europe/Brussels" },
    ]
    authorizationTestDb.getDelegate("setting").reset(initialSettings)
    const { ctx } = createAuthorizationPersona("normal", {
      id: brandManager.id,
      permissions: brandingPermissionSet,
    })

    await expect(invokeResolver(updateSiteBrandingSettings, {
      ...validBranding(),
      siteTitle: "Changed title",
      bandTimeZone,
    }, ctx)).rejects.toThrow()

    expect(authorizationTestDb.snapshot("setting")).toEqual(initialSettings)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it("rejects platform or unknown keys at the branding schema boundary", async () => {
    const { ctx } = createAuthorizationPersona("normal", {
      id: brandManager.id,
      permissions: brandingPermissionSet,
    })
    const forgedInput = {
      ...validBranding(),
      [Setting.Dashboard_HostingMode]: "CafeMarche",
    }

    await expect(invokeResolver(updateSiteBrandingSettings, forgedInput as any, ctx)).rejects.toThrow()
    expect(authorizationTestDb.snapshot("setting")).toEqual([])
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it("rejects unsafe asset URLs and colors which would break the application theme", async () => {
    const { ctx } = createAuthorizationPersona("normal", {
      id: brandManager.id,
      permissions: brandingPermissionSet,
    })

    const invalidBranding = [
      {
        ...validBranding(),
        siteFaviconUrl: "javascript:alert(1)",
      },
      {
        ...validBranding(),
        themePrimaryMain: "",
      },
    ]

    for (const branding of invalidBranding) {
      await expect(invokeResolver(
        updateSiteBrandingSettings,
        branding,
        ctx,
      )).rejects.toThrow()
    }
    expect(authorizationTestDb.snapshot("setting")).toEqual([])
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it("does not trust a stale session branding grant", async () => {
    const actorWithoutDatabaseGrant = createAuthorizationTestUser("normal", {
      id: brandManager.id,
      permissions: [Permission.login],
    })
    authorizationTestDb.reset({ user: [actorWithoutDatabaseGrant], setting: [], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: brandManager.id,
      permissions: brandingPermissionSet,
    })

    await expect(invokeResolver(
      updateSiteBrandingSettings,
      { ...validBranding(), siteTitle: "Forged", bandTimeZone: "Asia/Tokyo" },
      ctx,
    )).rejects.toThrow("Not authorized for manage_site_branding")
    expect(authorizationTestDb.snapshot("setting")).toEqual([])
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it.each(["public", "normal"] as const)("requires branding permission to change the band time zone as %s", async persona => {
    const { ctx } = createAuthorizationPersona(persona)

    await expect(invokeResolver(updateSiteBrandingSettings, {
      ...validBranding(),
      bandTimeZone: "Asia/Tokyo",
    }, ctx)).rejects.toThrow()

    expect(authorizationTestDb.snapshot("setting")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
    expect(clearBrandCache).not.toHaveBeenCalled()
  })

  it("keeps individual reads public without exposing the raw settings index", async () => {
    authorizationTestDb.getDelegate("setting").reset([
      { id: 1, name: Setting.Dashboard_SiteTitle, value: "Public title" },
    ])
    const { ctx: publicCtx } = createAuthorizationPersona("public")

    await expect(invokeResolver(
      getSetting,
      { name: Setting.Dashboard_SiteTitle },
      publicCtx,
    )).resolves.toBe("Public title")
    await expect(invokeResolver(getSiteBrandingSettings, {}, publicCtx)).resolves.toEqual(
      expect.objectContaining({ siteTitle: "Public title" }),
    )
    await expect(invokeResolver(
      getPaginatedSettings,
      { where: {}, orderBy: {}, skip: 0, take: 50 },
      publicCtx,
    )).rejects.toThrow()
  })

  it("accepts a freshly verified role-carried Sysadmin permission", async () => {
    const roleGrantedSysadmin = createAuthorizationTestUser("normal", {
      id: 703,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.sysadmin],
    })
    authorizationTestDb.reset({
      user: [roleGrantedSysadmin],
      setting: [{ id: 1, name: "technical_setting", value: "before" }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: roleGrantedSysadmin.id,
      permissions: [Permission.login, Permission.sysadmin],
    })

    await expect(invokeResolver(
      updateSetting,
      { name: "technical_setting", value: "forged" },
      ctx,
    )).resolves.toEqual(expect.objectContaining({ value: "forged" }))
    await expect(invokeResolver(
      updateBulkSettings,
      [{ name: "technical_setting", value: "forged" }],
      ctx,
    )).resolves.toBeUndefined()
    await expect(invokeResolver(
      getPaginatedSettings,
      { where: {}, orderBy: {}, skip: 0, take: 50 },
      ctx,
    )).resolves.toEqual(expect.objectContaining({ items: expect.any(Array) }))
    await expect(invokeResolver(
      setShowingAdminControls,
      { showAdminControls: true },
      ctx,
    )).resolves.toBeUndefined()
    await expect(invokeResolver(db3Query, forgeDb3Query("Setting"), ctx)).resolves.toBeDefined()
    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("Setting", 1, {
        id: 1,
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
      expect.objectContaining({ name: "technical_setting", value: "after" }),
    ])
    expect(clearBrandCache).toHaveBeenCalledTimes(1)
  })

  it("invalidates brand cache after a Sysadmin uses the raw DB3 setting grid", async () => {
    authorizationTestDb.reset({
      user: [sysadmin],
      setting: [{ id: 1, name: Setting.Dashboard_SiteTitle, value: "Before" }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("Setting", 1, {
        id: 1,
        name: Setting.Dashboard_SiteTitle,
        value: "After",
      }),
      ctx,
    )

    expect(authorizationTestDb.snapshot("setting")).toEqual([
      expect.objectContaining({ id: 1, value: "After" }),
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
