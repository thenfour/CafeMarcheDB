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
import * as db3 from "@db3/db3"
import deleteEventSongList from "src/core/db3/mutations/deleteEventSongList"
import updateGenericSortOrder from "src/core/db3/mutations/updateGenericSortOrder"
import updateUserEventAttendance from "src/core/db3/mutations/updateUserEventAttendanceMutation"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const rowScopedSortAuthMap: db3.DB3AuthContextPermissionMap = {
  PostQueryAsOwner: Permission.view_events,
  PostQuery: Permission.view_events,
  PreMutateAsOwner: Permission.respond_to_events,
  PreMutate: Permission.manage_events,
  PreInsert: Permission.manage_events,
}

// This test-only table proves that every shifted row is checked before the
// bulk operation writes anything. Production tables opt in alongside their
// own schema in exactly the same way.
const rowScopedSortTable = new db3.xTable({
  tableName: "AuthorizationSortFixture",
  deletePolicy: "hard",
  sortOrderPolicy: { groupingColumn: null, scope: "explicitRowIds" },
  tableAuthMap: {
    ViewOwn: Permission.view_events,
    View: Permission.view_events,
    EditOwn: Permission.respond_to_events,
    Edit: Permission.manage_events,
    Insert: Permission.manage_events,
  },
  getSelectionArgs: () => ({}),
  getRowInfo: row => ({
    pk: row.id,
    name: String(row.id),
    ownerUserId: row.ownerUserId,
  }),
  columns: [
    db3.MakePKfield(),
    db3.MakeSortOrderField({ authMap: rowScopedSortAuthMap }),
  ],
})

const publicVisibility = {
  id: 920_002, // Matches the inherited public-role grant in the database fixture.
  name: Permission.visibility_public,
  roles: [],
}

const membersVisibility = {
  id: 701,
  name: Permission.visibility_members,
  roles: [],
}

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 100,
  name: "Authorized event",
  locationDescription: "",
  startsAt: new Date("2026-09-20T18:00:00.000Z"),
  isDeleted: false,
  createdByUserId: null,
  visiblePermissionId: publicVisibility.id,
  visiblePermission: publicVisibility,
  revision: 1,
  calendarInputHash: "unchanged",
  segments: [],
  ...overrides,
})

describe("BA-S003 generic sort-order authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ change: [] })
  })

  it("rejects mismatched table identity before looking up the actor", async () => {
    const actor = createAuthorizationTestUser("normal", {
      id: 1,
      permissions: [Permission.login, Permission.customize_menu],
    })
    authorizationTestDb.reset({ user: [actor], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: actor.id,
      permissions: [Permission.login, Permission.customize_menu],
    })
    const userLookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: db3.xMenuLink.tableID,
      tableName: db3.xRole.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
    }, ctx)).rejects.toThrow("does not match")

    expect(userLookup).not.toHaveBeenCalled()
  })

  it("allows only explicitly opted-in tables", async () => {
    const permissions = [Permission.login, Permission.manage_users]
    const actor = createAuthorizationTestUser("normal", { id: 2, permissions })
    authorizationTestDb.reset({
      user: [actor],
      userTag: [
        { id: 1, text: "A", description: "", sortOrder: 0 },
        { id: 2, text: "B", description: "", sortOrder: 1 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: db3.xUserTag.tableID,
      tableName: db3.xUserTag.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
    }, ctx)).rejects.toThrow("Not authorized to mutate UserTag fields: sortOrder")

    expect(authorizationTestDb.snapshot("userTag")).toEqual([
      expect.objectContaining({ id: 1, sortOrder: 0 }),
      expect.objectContaining({ id: 2, sortOrder: 1 }),
    ])
  })

  it("uses fresh grants and stops before reading reorder targets", async () => {
    const sessionPermissions = [Permission.login, Permission.customize_menu]
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 3,
      permissions: [Permission.login],
    })
    authorizationTestDb.reset({
      user: [databaseActor],
      menuLink: [
        { id: 1, caption: "A", sortOrder: 0, createdByUserId: databaseActor.id },
        { id: 2, caption: "B", sortOrder: 1, createdByUserId: databaseActor.id },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: sessionPermissions,
    })
    const targetLookup = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "findMany")

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: db3.xMenuLink.tableID,
      tableName: db3.xMenuLink.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
    }, ctx)).rejects.toThrow("Not authorized to mutate MenuLink fields: sortOrder")

    expect(targetLookup).not.toHaveBeenCalled()
  })

  it("preflights every affected row before performing a write", async () => {
    const permissions = [Permission.login, Permission.view_events, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 4, permissions })
    authorizationTestDb.reset({
      user: [actor],
      authorizationSortFixture: [
        { id: 1, ownerUserId: actor.id, sortOrder: 0 },
        { id: 2, ownerUserId: 999, sortOrder: 1 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const update = vi.spyOn(
      authorizationTestDb.getDelegate("authorizationSortFixture"),
      "update",
    )

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: rowScopedSortTable.tableID,
      tableName: rowScopedSortTable.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
    }, ctx)).rejects.toThrow("Not authorized to mutate AuthorizationSortFixture")

    expect(update).not.toHaveBeenCalled()
  })

  it("reorders only the caller-supplied scope and preserves out-of-scope slots", async () => {
    const permissions = [Permission.login, Permission.customize_menu]
    const actor = createAuthorizationTestUser("normal", { id: 5, permissions })
    authorizationTestDb.reset({
      user: [actor],
      menuLink: [
        { id: 1, caption: "A", sortOrder: 0, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { id: 2, caption: "Hidden", sortOrder: 1, createdByUserId: actor.id, visiblePermissionId: membersVisibility.id, visiblePermission: membersVisibility },
        { id: 3, caption: "B", sortOrder: 2, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { id: 4, caption: "C", sortOrder: 3, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const targetLookup = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "findMany")

    await invokeResolver(updateGenericSortOrder, {
      tableID: db3.xMenuLink.tableID,
      tableName: db3.xMenuLink.tableName,
      movingItemId: 4,
      newPositionItemId: 1,
      scopeRowIds: [1, 3, 4],
    }, ctx)

    expect(targetLookup).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [1, 3, 4] } }),
    }))
    expect(authorizationTestDb.snapshot("menuLink")).toEqual([
      expect.objectContaining({ id: 1, sortOrder: 2 }),
      expect.objectContaining({ id: 2, sortOrder: 1 }),
      expect.objectContaining({ id: 3, sortOrder: 3 }),
      expect.objectContaining({ id: 4, sortOrder: 0 }),
    ])
  })

  it("rejects a hidden row supplied as part of the explicit scope", async () => {
    const permissions = [Permission.login, Permission.customize_menu]
    const actor = createAuthorizationTestUser("normal", { id: 6, permissions })
    authorizationTestDb.reset({
      user: [actor],
      menuLink: [
        { id: 1, caption: "Visible", sortOrder: 0, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { id: 2, caption: "Hidden", sortOrder: 1, createdByUserId: actor.id, visiblePermissionId: membersVisibility.id, visiblePermission: membersVisibility },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const update = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "update")

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: db3.xMenuLink.tableID,
      tableName: db3.xMenuLink.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
    }, ctx)).rejects.toThrow("Not authorized to mutate MenuLink fields: sortOrder")

    expect(update).not.toHaveBeenCalled()
  })

  it("rejects a scope row outside the declared ordering group", async () => {
    const permissions = [Permission.login, Permission.manage_events, Permission.view_events_nonpublic]
    const actor = createAuthorizationTestUser("normal", { id: 7, permissions })
    authorizationTestDb.reset({
      user: [actor],
      eventSongList: [
        { id: 1, eventId: 100, name: "A", description: "", sortOrder: 0 },
        { id: 2, eventId: 200, name: "Other group", description: "", sortOrder: 1 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const update = vi.spyOn(authorizationTestDb.getDelegate("eventSongList"), "update")

    await expect(invokeResolver(updateGenericSortOrder, {
      tableID: db3.xEventSongList.tableID,
      tableName: db3.xEventSongList.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
      groupByColumn: "eventId",
      groupValue: 100,
    }, ctx)).rejects.toThrow("Not authorized to mutate EventSongList fields: sortOrder")

    expect(update).not.toHaveBeenCalled()
  })

  it("reorders an authorized group without touching another group", async () => {
    const permissions = [
      Permission.login,
      Permission.manage_events,
      Permission.view_events_nonpublic,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 5, permissions })
    authorizationTestDb.reset({
      user: [actor],
      eventSongList: [
        { id: 1, eventId: 100, name: "A", description: "", sortOrder: 0 },
        { id: 2, eventId: 100, name: "B", description: "", sortOrder: 1 },
        { id: 3, eventId: 200, name: "Other", description: "", sortOrder: 7 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateGenericSortOrder, {
      tableID: db3.xEventSongList.tableID,
      tableName: db3.xEventSongList.tableName,
      movingItemId: 1,
      newPositionItemId: 2,
      scopeRowIds: [1, 2],
      groupByColumn: "eventId",
      groupValue: 100,
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({ id: 1, sortOrder: 1 }),
      expect.objectContaining({ id: 2, sortOrder: 0 }),
      expect.objectContaining({ id: 3, sortOrder: 7 }),
    ])
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({ table: "EventSongList", action: "update" }),
    ])
  })

  it("repairs duplicate setlist sort-order slots while reordering", async () => {
    const permissions = [
      Permission.login,
      Permission.manage_events,
      Permission.view_events_nonpublic,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 5, permissions })
    authorizationTestDb.reset({
      user: [actor],
      eventSongList: [
        { id: 650, eventId: 647, name: "Setlist", description: "", sortOrder: 0 },
        { id: 651, eventId: 647, name: "Set 2", description: "", sortOrder: 0 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateGenericSortOrder, {
      tableID: db3.xEventSongList.tableID,
      tableName: db3.xEventSongList.tableName,
      movingItemId: 650,
      newPositionItemId: 651,
      scopeRowIds: [650, 651],
      groupByColumn: "eventId",
      groupValue: 647,
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({ id: 650, sortOrder: 1 }),
      expect.objectContaining({ id: 651, sortOrder: 0 }),
    ])
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({ table: "EventSongList", action: "update" }),
    ])
  })
})

describe("BA-S003 event song-list deletion", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ change: [] })
  })

  it("requires fresh manage-events authority before target lookup", async () => {
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 10,
      permissions: [Permission.login],
    })
    authorizationTestDb.reset({ user: [databaseActor], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: [Permission.login, Permission.manage_events],
    })
    const targetLookup = vi.spyOn(
      authorizationTestDb.getDelegate("eventSongList"),
      "findFirst",
    )

    await expect(invokeResolver(deleteEventSongList, { id: 20 }, ctx)).rejects.toThrow(
      "Not authorized to mutate EventSongList fields: id",
    )
    expect(targetLookup).not.toHaveBeenCalled()
  })

  it("deletes an authorized list and its children in one audited operation", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 11, permissions })
    authorizationTestDb.reset({
      user: [actor],
      event: [makeEvent()],
      eventSongList: [{
        id: 20,
        eventId: 100,
        name: "Setlist",
        description: "",
        isActuallyPlayed: false,
        isOrdered: true,
        sortOrder: 0,
      }],
      eventSongListSong: [{
        id: 21,
        eventSongListId: 20,
        songId: 300,
        sortOrder: 0,
        subtitle: "",
      }],
      eventSongListDivider: [],
      eventSegment: [],
      eventStatus: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(deleteEventSongList, { id: 20 }, ctx)

    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([])
    expect(authorizationTestDb.snapshot("eventSongListSong")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({
        table: "EventSongList",
        recordId: 20,
        action: "delete",
      }),
    ])
  })
})

describe("BA-S003 event attendance ownership", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ change: [] })
  })

  it("lets a responder create only their own event and segment responses", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 30, permissions })
    authorizationTestDb.reset({
      user: [actor],
      event: [makeEvent()],
      eventSegment: [{ id: 101, eventId: 100, startsAt: null, durationMillis: BigInt(0), isAllDay: false, dateTimeVersion: 2 }],
      eventSegmentUserResponse: [],
      eventUserResponse: [],
      eventStatus: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      userId: actor.id,
      eventId: 100,
      comment: "I will be there",
      segmentResponses: { 101: { attendanceId: 2 } },
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([
      expect.objectContaining({
        userId: actor.id,
        eventSegmentId: 101,
        attendanceId: 2,
        createdByUserId: actor.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([
      expect.objectContaining({
        userId: actor.id,
        eventId: 100,
        userComment: "I will be there",
      }),
    ])
  })

  it("rejects a forged other-user response before event lookup", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 31, permissions })
    const target = createAuthorizationTestUser("normal", { id: 32 })
    authorizationTestDb.reset({ user: [actor, target], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      userId: target.id,
      eventId: 100,
      comment: "Forged",
    }, ctx)).rejects.toThrow(`required: ${Permission.change_others_event_responses}`)

    expect(eventLookup).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("rechecks change-others against the database actor", async () => {
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 41,
      permissions: [Permission.login],
    })
    const target = createAuthorizationTestUser("normal", { id: 42 })
    authorizationTestDb.reset({ user: [databaseActor, target], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: [Permission.login, Permission.change_others_event_responses],
    })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      userId: target.id,
      eventId: 100,
      comment: "Stale grant",
    }, ctx)).rejects.toThrow(`required: ${Permission.change_others_event_responses}`)

    expect(eventLookup).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("uses change-others authority independently of manage-events", async () => {
    const permissions = [Permission.login, Permission.change_others_event_responses]
    const actor = createAuthorizationTestUser("normal", { id: 33, permissions })
    const target = createAuthorizationTestUser("normal", { id: 34 })
    authorizationTestDb.reset({
      user: [actor, target],
      event: [makeEvent()],
      eventSegment: [{ id: 101, eventId: 100, startsAt: null, durationMillis: BigInt(0), isAllDay: false, dateTimeVersion: 2 }],
      eventSegmentUserResponse: [{
        id: 201,
        userId: target.id,
        eventSegmentId: 101,
        attendanceId: null,
      }],
      eventUserResponse: [{
        id: 202,
        userId: target.id,
        eventId: 100,
        revision: 1,
        userComment: "",
        instrumentId: null,
        isInvited: false,
      }],
      eventStatus: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      userId: target.id,
      eventId: 100,
      comment: "Updated by delegate",
      segmentResponses: { 101: { attendanceId: 2 } },
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([
      expect.objectContaining({ id: 201, attendanceId: 2, updatedByUserId: actor.id }),
    ])
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([
      expect.objectContaining({
        id: 202,
        userComment: "Updated by delegate",
        revision: 2,
      }),
    ])
  })

  it("keeps invitation changes behind manage-events", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 35, permissions })
    authorizationTestDb.reset({ user: [actor], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(updateUserEventAttendance, {
      userId: actor.id,
      eventId: 100,
      isInvited: true,
    }, ctx)).rejects.toThrow(`required: ${Permission.manage_events}`)

    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("allows manage-events to invite another user without response-edit authority", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 44, permissions })
    const target = createAuthorizationTestUser("normal", { id: 45 })
    authorizationTestDb.reset({
      user: [actor, target],
      event: [makeEvent()],
      eventUserResponse: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      userId: target.id,
      eventId: 100,
      isInvited: true,
    }, ctx)

    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([
      expect.objectContaining({
        userId: target.id,
        eventId: 100,
        isInvited: true,
      }),
    ])
  })

  it("rejects segment IDs outside the declared event before any response write", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 36, permissions })
    authorizationTestDb.reset({
      user: [actor],
      event: [makeEvent()],
      eventSegment: [{ id: 102, eventId: 999 }],
      eventSegmentUserResponse: [],
      eventUserResponse: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(updateUserEventAttendance, {
      userId: actor.id,
      eventId: 100,
      segmentResponses: { 102: { attendanceId: 2 } },
    }, ctx)).rejects.toThrow()

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([])
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("rejects malformed segment identifiers at the request boundary", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 43, permissions })
    authorizationTestDb.reset({ user: [actor], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      userId: actor.id,
      eventId: 100,
      segmentResponses: { "101suffix": { attendanceId: 2 } },
    } as never, ctx)).rejects.toThrow("Invalid event segment ID")

    expect(eventLookup).not.toHaveBeenCalled()
  })

  it("does not let generic inserts bypass the self-versus-other boundary", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 37, permissions })
    const target = createAuthorizationTestUser("normal", { id: 38 })
    authorizationTestDb.reset({
      user: [actor, target],
      eventSegmentUserResponse: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(db3Mutation, forgeDb3Insert(
      db3.xEventSegmentUserResponse.tableID,
      { userId: target.id, eventSegmentId: 101, attendanceId: 2 },
    ), ctx)).rejects.toThrow("Not authorized to mutate EventSegmentUserResponse")

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([])
  })

  it("does not substitute manage-events for change-others in generic updates", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 39, permissions })
    const target = createAuthorizationTestUser("normal", { id: 40 })
    authorizationTestDb.reset({
      user: [actor, target],
      eventSegmentUserResponse: [{
        id: 203,
        userId: target.id,
        eventSegmentId: 101,
        attendanceId: null,
      }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(db3Mutation, forgeDb3Update(
      db3.xEventSegmentUserResponse.tableID,
      203,
      { id: 203, attendanceId: 2 },
    ), ctx)).rejects.toThrow("Not authorized to mutate EventSegmentUserResponse")

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([
      expect.objectContaining({ id: 203, attendanceId: null }),
    ])
  })
})

describe("Band Admin split mutation boundaries", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ change: [] })
  })

  it("separates file renaming from server-owned storage metadata", async () => {
    const permissions = [
      Permission.login,
      Permission.view_files,
      Permission.manage_files,
      Permission.admin_files,
      Permission.visibility_public,
    ]
    const actor = createAuthorizationTestUser("bandAdmin", { id: 60, permissions })
    const visibilityId = actor.role!.permissions.find(
      entry => entry.permission.name === Permission.visibility_public,
    )!.permissionId
    const file = {
      id: 61,
      fileLeafName: "old-name.pdf",
      storedLeafName: "server-storage-id.pdf",
      description: "",
      isDeleted: false,
      uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
      uploadedByUserId: 999,
      visiblePermissionId: visibilityId,
      sizeBytes: 123,
      mimeType: "application/pdf",
      customData: null,
    }
    authorizationTestDb.reset({ user: [actor], file: [file], change: [] })
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: actor.id, permissions })

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("File", file.id, { fileLeafName: "corrected-name.pdf" }),
      ctx,
    )
    expect(authorizationTestDb.snapshot("file")).toEqual([
      expect.objectContaining({ fileLeafName: "corrected-name.pdf" }),
    ])

    for (const [field, value] of [
      ["storedLeafName", "forged.pdf"],
      ["sizeBytes", 999],
      ["mimeType", "text/plain"],
      ["customData", "forged"],
      ["uploadedByUserId", actor.id],
    ] as const) {
      await expect(invokeResolver(
        db3Mutation,
        forgeDb3Update("File", file.id, { [field]: value }),
        ctx,
      )).rejects.toThrow("Not authorized to mutate File fields")
    }
  })

  it("requires manage_user_taxonomy for tag definitions independently of manage_users", async () => {
    const profilePermissions = [Permission.login, Permission.basic_trust, Permission.manage_users]
    const profileManager = createAuthorizationTestUser("moderator", { id: 62, permissions: profilePermissions })
    const taxonomyPermissions = [...profilePermissions, Permission.manage_user_taxonomy]
    const taxonomyManager = createAuthorizationTestUser("bandAdmin", { id: 63, permissions: taxonomyPermissions })
    const tag = { id: 64, text: "Brass", description: "", sortOrder: 0, color: null, significance: null }
    authorizationTestDb.reset({ user: [profileManager, taxonomyManager], userTag: [tag], change: [] })

    const { ctx: profileCtx } = createAuthorizationPersona("moderator", {
      id: profileManager.id,
      permissions: profilePermissions,
    })
    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("UserTag", tag.id, { text: "Winds" }),
      profileCtx,
    )).rejects.toThrow("Not authorized to mutate UserTag fields")

    const { ctx: taxonomyCtx } = createAuthorizationPersona("bandAdmin", {
      id: taxonomyManager.id,
      permissions: taxonomyPermissions,
    })
    await invokeResolver(
      db3Mutation,
      forgeDb3Update("UserTag", tag.id, { text: "Winds" }),
      taxonomyCtx,
    )
    expect(authorizationTestDb.snapshot("userTag")).toEqual([
      expect.objectContaining({ id: tag.id, text: "Winds" }),
    ])
  })

  it("uses admin_instruments as the sole instrument-management capability", async () => {
    const ordinaryPermissions = [Permission.login, Permission.basic_trust, Permission.manage_users]
    const ordinaryManager = createAuthorizationTestUser("moderator", { id: 65, permissions: ordinaryPermissions })
    const instrumentPermissions = [...ordinaryPermissions, Permission.admin_instruments]
    const instrumentAdmin = createAuthorizationTestUser("bandAdmin", { id: 66, permissions: instrumentPermissions })
    const instrument = {
      id: 67,
      name: "Trumpet",
      description: "",
      autoAssignFileLeafRegex: "tpt",
      sortOrder: 0,
      functionalGroupId: 1,
      functionalGroup: null,
    }
    authorizationTestDb.reset({ user: [ordinaryManager, instrumentAdmin], instrument: [instrument], change: [] })

    const { ctx: ordinaryCtx } = createAuthorizationPersona("moderator", {
      id: ordinaryManager.id,
      permissions: ordinaryPermissions,
    })
    await expect(invokeResolver(
      db3Mutation,
      forgeDb3Update("Instrument", instrument.id, { name: "Cornet" }),
      ordinaryCtx,
    )).rejects.toThrow("Not authorized to mutate Instrument fields")

    const { ctx: adminCtx } = createAuthorizationPersona("bandAdmin", {
      id: instrumentAdmin.id,
      permissions: instrumentPermissions,
    })
    await invokeResolver(
      db3Mutation,
      forgeDb3Update("Instrument", instrument.id, { name: "Cornet" }),
      adminCtx,
    )
    expect(authorizationTestDb.snapshot("instrument")).toEqual([
      expect.objectContaining({ id: instrument.id, name: "Cornet" }),
    ])
  })
})
