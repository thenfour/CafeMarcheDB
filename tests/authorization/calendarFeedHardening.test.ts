import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import getMyCalendarSubscription from "src/auth/queries/getMyCalendarSubscription"
import replaceMyCalendarSubscription from "src/auth/mutations/replaceMyCalendarSubscription"
import {
  CalendarFeedAuthorizationError,
  CalendarFeedNotFoundError,
  resolveCalendarFeedRequestUser,
} from "src/auth/server/calendarFeedSubscription"
import { createCalendar } from "src/core/db3/server/ical"
import { redactSensitiveActionUri } from "src/core/db3/server/recordActionServer"
import {
  UserArgs,
  UserForCalBackendArgs,
  UserSafeArgs,
} from "src/core/db3/shared/schema/prismArgs"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import {
  AUDIT_REDACTED_VALUE,
  ChangeAction,
  CreateChangeContext,
  RegisterChange,
  redactAuditValues,
} from "@/src/auth/server/activityLog"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { loadAuthorization } from "src/auth/server/serverAuthorization"
import { invokeResolver } from "./support/resolverHarness"

import { calendarAuthorizationSeed, calendarBandPublicId } from "../support/calendarFeedFixtures"

const context = { bandPublicId: calendarBandPublicId }
const existingToken = "a".repeat(64)
const otherToken = "b".repeat(64)

describe("BA-S001 calendar subscription ownership and lifecycle", () => {
  const owner = createAuthorizationTestUser("normal", {
    id: 10,
    calendarFeedToken: existingToken,
  })
  const target = createAuthorizationTestUser("normal", {
    id: 20,
    calendarFeedToken: otherToken,
  })

  beforeEach(() => {
    process.env.CMDB_BASE_URL = "https://band.test"
    authorizationTestDb.reset(calendarAuthorizationSeed([owner, target]))
    vi.restoreAllMocks()
  })

  it("preserves and returns the account owner's existing subscription", async () => {
    const { ctx } = createAuthorizationPersona("normal", {
      id: owner.id,
      calendarFeedToken: existingToken,
    })

    const result = await invokeResolver(getMyCalendarSubscription, context, ctx)

    expect(result).toEqual({
      subscriptionUrl: `https://band.test/api/ical/user/${existingToken}/upcoming?bandPublicId=${calendarBandPublicId}`,
      webcalUrl: `webcal://band.test/api/ical/user/${existingToken}/upcoming?bandPublicId=${calendarBandPublicId}`,
    })
    expect(authorizationTestDb.snapshot("user")).toEqual([expect.objectContaining(owner), expect.objectContaining(target)])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("creates a strong subscription credential only when the owner first opens the page", async () => {
    const ownerWithoutToken = { ...owner, calendarFeedToken: null }
    authorizationTestDb.reset(calendarAuthorizationSeed([ownerWithoutToken, target]))
    const { ctx } = createAuthorizationPersona("normal", {
      id: owner.id,
      calendarFeedToken: null,
    })

    const result = await invokeResolver(getMyCalendarSubscription, context, ctx)
    const storedOwner = authorizationTestDb.snapshot("user").find(user => user.id === owner.id)!
    const generatedToken = storedOwner.calendarFeedToken as string

    expect(generatedToken).toMatch(/^[a-f0-9]{64}$/)
    expect(result.subscriptionUrl).toContain(generatedToken)
    expect(result.webcalUrl).toContain(generatedToken)

    const audit = authorizationTestDb.snapshot("change")
    expect(audit).toEqual([
      expect.objectContaining({
        context: "createCalendarFeedSubscription",
        recordId: owner.id,
        oldValues: JSON.stringify({ calendarFeedEnabled: false }),
        newValues: JSON.stringify({ calendarFeedEnabled: true }),
      }),
    ])
    expect(JSON.stringify(audit)).not.toContain(generatedToken)
  })

  it("rejects a forged target user id and exposes only the signed-in Band Admin's link", async () => {
    const bandAdmin = createAuthorizationTestUser("bandAdmin", {
      id: 30,
      calendarFeedToken: existingToken,
    })
    authorizationTestDb.reset(calendarAuthorizationSeed([bandAdmin, target]))
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: bandAdmin.id,
      calendarFeedToken: existingToken,
    })

    // Forged transport fields must fail schema validation before touching the credential.
    await expect(invokeResolver(getMyCalendarSubscription, { ...context, userId: target.id } as never, ctx)).rejects.toThrow()
    const result = await invokeResolver(getMyCalendarSubscription, context, ctx)

    expect(result.subscriptionUrl).toContain(existingToken)
    expect(result.subscriptionUrl).not.toContain(otherToken)
  })

  it("blocks token retrieval and replacement while impersonating another user", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: owner.id })
    ctx.session.$publicData.impersonatingFromUserId = 999
    const findFirst = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")

    await expect(invokeResolver(getMyCalendarSubscription, context, ctx))
      .rejects.toBeInstanceOf(CalendarFeedAuthorizationError)
    await expect(invokeResolver(replaceMyCalendarSubscription, context, ctx))
      .rejects.toBeInstanceOf(CalendarFeedAuthorizationError)

    expect(findFirst).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("does not create a link for a deactivated account", async () => {
    const deletedOwner = { ...owner, isDeleted: true, calendarFeedToken: null }
    authorizationTestDb.reset(calendarAuthorizationSeed([deletedOwner]))
    const { ctx } = createAuthorizationPersona("normal", {
      id: owner.id,
      isDeleted: true,
      calendarFeedToken: null,
    })

    await expect(invokeResolver(getMyCalendarSubscription, context, ctx)).rejects.toThrow()
    expect(authorizationTestDb.snapshot("user")).toEqual([expect.objectContaining(deletedOwner)])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("replaces the link only on explicit recovery and never audits either credential", async () => {
    const { ctx } = createAuthorizationPersona("normal", {
      id: owner.id,
      calendarFeedToken: existingToken,
    })

    const result = await invokeResolver(replaceMyCalendarSubscription, context, ctx)
    const storedOwner = authorizationTestDb.snapshot("user").find(user => user.id === owner.id)!
    const replacementToken = storedOwner.calendarFeedToken as string

    expect(replacementToken).toMatch(/^[a-f0-9]{64}$/)
    expect(replacementToken).not.toBe(existingToken)
    expect(result.subscriptionUrl).toContain(replacementToken)

    const audit = authorizationTestDb.snapshot("change")
    expect(audit).toEqual([
      expect.objectContaining({
        context: "replaceCalendarFeedSubscription",
        recordId: owner.id,
        oldValues: JSON.stringify({ calendarFeedLinkReplaced: false }),
        newValues: JSON.stringify({ calendarFeedLinkReplaced: true }),
      }),
    ])
    expect(JSON.stringify(audit)).not.toContain(existingToken)
    expect(JSON.stringify(audit)).not.toContain(replacementToken)
  })

  it.each([{}, { bandPublicId: null }, { bandPublicId: 1 }, { ...context, bandUserId: 10 }])("rejects invalid band context before accessing credentials: %j", async input => {
    const { ctx } = createAuthorizationPersona("normal", { id: owner.id })
    const before = authorizationTestDb.snapshot("user")
    // Malformed transport values intentionally bypass the client's TypeScript contract.
    await expect(invokeResolver(getMyCalendarSubscription, input as never, ctx)).rejects.toThrow()
    await expect(invokeResolver(replaceMyCalendarSubscription, input as never, ctx)).rejects.toThrow()
    expect(authorizationTestDb.snapshot("user")).toEqual(before)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it.each(["create", "replace"])("rolls back credential %s if its audit fails", async mode => {
    const user = { ...owner, calendarFeedToken: mode === "create" ? null : existingToken }
    authorizationTestDb.reset(calendarAuthorizationSeed([user]))
    const { ctx } = createAuthorizationPersona("normal", { id: owner.id })
    const before = authorizationTestDb.snapshot("user")
    vi.spyOn(authorizationTestDb.getDelegate("change"), "create").mockRejectedValue(new Error("Audit unavailable"))
    const resolver = mode === "create" ? getMyCalendarSubscription : replaceMyCalendarSubscription
    await expect(invokeResolver(resolver, context, ctx)).rejects.toThrow("Audit unavailable")
    expect(authorizationTestDb.snapshot("user")).toEqual(before)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})

describe("BA-S001 calendar endpoint identity", () => {
  const activeUser = {
    ...createAuthorizationTestUser("normal", { id: 10, calendarFeedToken: existingToken }),
    uid: "calendar-user-uid", mergedIntoUserId: null, globalRoleId: null,
  }

  beforeEach(() => {
    authorizationTestDb.reset({ user: [activeUser] })
    vi.restoreAllMocks()
  })

  it("allows public access only through the explicit public route", async () => {
    const findFirst = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")

    await expect(resolveCalendarFeedRequestUser("public")).resolves.toBeNull()
    expect(findFirst).not.toHaveBeenCalled()

    await expect(resolveCalendarFeedRequestUser("not-a-token"))
      .rejects.toBeInstanceOf(CalendarFeedNotFoundError)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("resolves only an active account for a valid bearer credential", async () => {
    const findFirst = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")

    await expect(resolveCalendarFeedRequestUser(existingToken)).resolves.toEqual(activeUser)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { calendarFeedToken: existingToken, isDeleted: false, mergedIntoUserId: null },
    }))

    authorizationTestDb.reset({ user: [{ ...activeUser, isDeleted: true }] })
    await expect(resolveCalendarFeedRequestUser(existingToken))
      .rejects.toBeInstanceOf(CalendarFeedNotFoundError)
    await expect(resolveCalendarFeedRequestUser(otherToken))
      .rejects.toBeInstanceOf(CalendarFeedNotFoundError)

    authorizationTestDb.reset({ user: [{ ...activeUser, mergedIntoUserId: 20 }] })
    await expect(resolveCalendarFeedRequestUser(existingToken))
      .rejects.toBeInstanceOf(CalendarFeedNotFoundError)
  })

  it("does not embed the bearer URL in generated calendar metadata", async () => {
    const calendar = await createCalendar({
      icalSettings: {
        calendarName: "Band agenda",
        calendarCompany: "Band",
        calendarProduct: "Backstage",
        eventNamePrefix: "Band: ",
      },
    })
    const output = calendar.toString()

    expect(output).not.toContain(existingToken)
    expect(output).not.toMatch(/^SOURCE:/m)
    expect(output).not.toMatch(/^URL:/m)
  })
})

describe("BA-S001 credential containment", () => {
  beforeEach(() => {
    authorizationTestDb.reset(calendarAuthorizationSeed([createAuthorizationTestUser("sysadmin", { id: 1 })]))
    vi.restoreAllMocks()
  })

  it("keeps calendar credentials out of every shared User selector", () => {
    for (const args of [UserArgs, UserSafeArgs, UserWithRolesArgs, UserForCalBackendArgs]) {
      expect(args.select).not.toHaveProperty("calendarFeedToken")
      expect(args.select).not.toHaveProperty("accessToken")
      expect(args.select).not.toHaveProperty("hashedPassword")
    }
  })

  it("recursively redacts credentials and hashes while retaining non-secret audit markers", () => {
    const nullPrototype = Object.assign(Object.create(null), {
      apiToken: "nested-token",
      harmless: true,
    })
    const result = redactAuditValues({
      hashedPassword: "password-hash",
      passwordReset: true,
      calendarFeedToken: existingToken,
      nested: [{ oauthSecretHash: "secret-hash" }, nullPrototype],
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    })

    expect(result).toEqual({
      hashedPassword: AUDIT_REDACTED_VALUE,
      passwordReset: true,
      calendarFeedToken: AUDIT_REDACTED_VALUE,
      nested: [
        { oauthSecretHash: AUDIT_REDACTED_VALUE },
        { apiToken: AUDIT_REDACTED_VALUE, harmless: true },
      ],
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  })

  it("applies recursive redaction immediately before an audit record is persisted", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: 1 })

    await RegisterChange({
      action: ChangeAction.update,
      changeContext: CreateChangeContext("credentialRedactionTest"),
      table: "User",
      pkid: 10,
      oldValues: { hashedPassword: "old-password-hash", calendarFeedToken: existingToken },
      newValues: { hashedPassword: "new-password-hash", calendarFeedToken: otherToken },
      auth: await loadAuthorization(ctx.session),
      options: { dontCalculateChanges: true },
      db: authorizationTestDb as never,
    })

    const serializedAudit = JSON.stringify(authorizationTestDb.snapshot("change"))
    expect(serializedAudit).not.toContain("old-password-hash")
    expect(serializedAudit).not.toContain("new-password-hash")
    expect(serializedAudit).not.toContain(existingToken)
    expect(serializedAudit).not.toContain(otherToken)
    expect(serializedAudit).toContain(AUDIT_REDACTED_VALUE)
  })

  it("redacts calendar bearer credentials from telemetry paths", () => {
    const uri = `/api/ical/user/${existingToken}/upcoming?source=calendar`
    const redacted = redactSensitiveActionUri(uri)

    expect(redacted).toBe("/api/ical/user/[calendarFeedToken]/upcoming?source=calendar")
    expect(redacted).not.toContain(existingToken)
  })
})
