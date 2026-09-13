import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("../authorization/support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import { Setting } from "shared/settingKeys"
import { loadBandTimeZone } from "src/server/dateTime"
import getDashboardData from "src/auth/queries/getDashboardData"
import { authorizationTestDb } from "../authorization/support/inMemoryPrisma"
import { createAuthorizationPersona } from "../authorization/support/authorizationFixtures"
import { invokeResolver } from "../authorization/support/resolverHarness"

describe("server band timezone configuration", () => {
  beforeEach(() => authorizationTestDb.reset({ setting: [] }))

  it("uses Brussels without writing a setting when none is configured", async () => {
    await expect(loadBandTimeZone()).resolves.toBe("Europe/Brussels")
    expect(authorizationTestDb.snapshot("setting")).toEqual([])
  })

  it("observes a changed configured zone on the next read", async () => {
    authorizationTestDb.reset({ setting: [{ id: 1, name: Setting.BandTimeZone, value: "Asia/Tokyo" }] })
    await expect(loadBandTimeZone()).resolves.toBe("Asia/Tokyo")
    authorizationTestDb.reset({ setting: [{ id: 1, name: Setting.BandTimeZone, value: "America/Los_Angeles" }] })
    await expect(loadBandTimeZone()).resolves.toBe("America/Los_Angeles")
  })

  it("fails on invalid stored configuration instead of silently changing timezone", async () => {
    authorizationTestDb.reset({ setting: [{ id: 1, name: Setting.BandTimeZone, value: "Moon/Base" }] })
    await expect(loadBandTimeZone()).rejects.toThrow()
  })

  it("delivers the configured timezone through dashboard data without requiring branding edit permission", async () => {
    authorizationTestDb.reset({ setting: [{ id: 1, name: Setting.BandTimeZone, value: "Asia/Tokyo" }] })
    const { ctx } = createAuthorizationPersona("public")
    await expect(invokeResolver(getDashboardData, {}, ctx)).resolves.toMatchObject({ bandTimeZone: "Asia/Tokyo" })
  })
})
