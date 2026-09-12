import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", () => ({
  default: {
    setting: {
      findMany: vi.fn(),
    },
  },
}))

import db from "db"
import { HostingMode } from "shared/brandConfigBase"
import { Setting } from "shared/settingKeys"
import { clearBrandCache, loadDbBrandConfig } from "src/server/brand"

const findMany = vi.mocked(db.setting.findMany)

const validRows = (overrides: Partial<Record<Setting, string>> = {}) => {
  const values: Partial<Record<Setting, string>> = {
    [Setting.Dashboard_HostingMode]: HostingMode.GenericSingleTenant,
    [Setting.Dashboard_SiteTitle]: "Example Band",
    [Setting.Dashboard_SiteTitlePrefix]: "EB: ",
    [Setting.Dashboard_SiteFaviconUrl]: "/example-favicon.png",
    [Setting.Dashboard_SiteLogoUrl]: "/example-logo.png",
    [Setting.Dashboard_Theme_PrimaryMain]: "#123456",
    [Setting.Dashboard_Theme_SecondaryMain]: "rgb(12, 34, 56)",
    [Setting.Dashboard_Theme_BackgroundDefault]: "#fafafa",
    [Setting.Dashboard_Theme_BackgroundPaper]: "#ffffff",
    [Setting.Dashboard_Theme_TextPrimary]: "",
    [Setting.Dashboard_Theme_ContrastText]: "hsl(50, 80%, 50%)",
    ...overrides,
  }
  return Object.entries(values).map(([name, value]) => ({ name, value })) as any
}

describe("site brand loading", () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  it("loads and validates a complete database brand", async () => {
    findMany.mockResolvedValueOnce(validRows())

    await expect(loadDbBrandConfig("brand-load.example:10455")).resolves.toEqual({
      hostingMode: HostingMode.GenericSingleTenant,
      siteTitle: "Example Band",
      siteTitlePrefix: "EB: ",
      siteFaviconUrl: "/example-favicon.png",
      siteLogoUrl: "/example-logo.png",
      theme: {
        primaryMain: "#123456",
        secondaryMain: "rgb(12, 34, 56)",
        backgroundDefault: "#fafafa",
        backgroundPaper: "#ffffff",
        textPrimary: "",
        contrastText: "hsl(50, 80%, 50%)",
      },
    })
  })

  it("serves an expired last-known-good brand when refresh fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findMany.mockResolvedValueOnce(validRows())
    const initial = await loadDbBrandConfig("stale-brand.example")
    clearBrandCache("stale-brand.example")
    findMany.mockRejectedValueOnce(new Error("database unavailable"))

    await expect(loadDbBrandConfig("stale-brand.example")).resolves.toEqual(initial)
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("serving the last known good value"),
      expect.objectContaining({ message: "database unavailable" }),
    )
    errorLog.mockRestore()
  })

  it("refreshes an invalidated cache entry when valid settings have changed", async () => {
    findMany.mockResolvedValueOnce(validRows())
    await loadDbBrandConfig("brand-update.example")
    clearBrandCache("brand-update.example")
    findMany.mockResolvedValueOnce(validRows({
      [Setting.Dashboard_SiteTitle]: "Updated Band",
    }))

    await expect(loadDbBrandConfig("brand-update.example")).resolves.toMatchObject({
      siteTitle: "Updated Band",
    })
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it("serves the last-known-good brand when refreshed settings are invalid", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findMany.mockResolvedValueOnce(validRows())
    const initial = await loadDbBrandConfig("invalid-refresh.example")
    clearBrandCache("invalid-refresh.example")
    findMany.mockResolvedValueOnce(validRows({
      [Setting.Dashboard_Theme_PrimaryMain]: "",
    }))

    await expect(loadDbBrandConfig("invalid-refresh.example")).resolves.toEqual(initial)
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("serving the last known good value"),
      expect.anything(),
    )
    errorLog.mockRestore()
  })

  it("fails visibly instead of returning the default brand when no valid brand was loaded", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findMany.mockRejectedValueOnce(new Error("database unavailable"))

    await expect(loadDbBrandConfig("initial-failure.example")).rejects.toThrow("database unavailable")
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load an initial brand"),
      expect.objectContaining({ message: "database unavailable" }),
    )
    errorLog.mockRestore()
  })
})
