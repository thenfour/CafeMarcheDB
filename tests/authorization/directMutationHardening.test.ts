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
import executeDB3CommandMutation from "@db3/mutations/executeDB3Command"
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

describe("DB3 command boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ change: [] })
  })

  it("rejects unknown command IDs at the registered server boundary", async () => {
    const permissions = [Permission.login]
    const actor = createAuthorizationTestUser("normal", { id: 91, permissions })
    authorizationTestDb.reset({ user: [actor], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: "Missing_Command",
      payload: {},
    }, ctx)).rejects.toThrow("Unknown DB3 command 'Missing_Command'")
  })

  it("sets RolePermission associations through the registered command and schema policy", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 94 })
    const role = {
      id: 200,
      name: "Members",
      description: "",
      color: null,
      significance: null,
      sortOrder: 0,
      isPublicRole: false,
      isSysAdminRole: false,
      isRoleForNewUsers: false,
      permissions: [],
    }
    const permission = {
      id: 300,
      name: Permission.manage_events,
      description: "",
      color: null,
      iconName: null,
      significance: null,
      sortOrder: 0,
      isVisibility: false,
      roles: [],
    }
    authorizationTestDb.reset({
      user: [actor],
      role: [role],
      permission: [permission],
      rolePermission: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })
    const makeRequest = (isAssociated: boolean) => ({
      commandID: db3.setRolePermissionCommand.commandID,
      payload: {
        localIdentity: permission.id,
        foreignIdentity: role.id,
        isAssociated,
      },
    })

    await expect(invokeResolver(
      executeDB3CommandMutation,
      makeRequest(true),
      ctx,
    )).resolves.toEqual(makeRequest(true).payload)
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([
      expect.objectContaining({ roleId: role.id, permissionId: permission.id }),
    ])

    // Setting the same state is idempotent and does not duplicate the join row.
    await invokeResolver(executeDB3CommandMutation, makeRequest(true), ctx)
    expect(authorizationTestDb.snapshot("rolePermission")).toHaveLength(1)

    await invokeResolver(executeDB3CommandMutation, makeRequest(false), ctx)
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([])
  })

  it("rejects RolePermission commands for a logged-in non-sysadmin", async () => {
    const actor = createAuthorizationTestUser("limited", { id: 95 })
    const role = {
      id: 201,
      name: "Members",
      description: "",
      color: null,
      significance: null,
      sortOrder: 0,
      isPublicRole: false,
      isSysAdminRole: false,
      isRoleForNewUsers: false,
      permissions: [],
    }
    const permission = {
      id: 301,
      name: Permission.manage_events,
      description: "",
      color: null,
      iconName: null,
      significance: null,
      sortOrder: 0,
      isVisibility: false,
      roles: [],
    }
    authorizationTestDb.reset({
      user: [actor],
      role: [role],
      permission: [permission],
      rolePermission: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("limited", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.setRolePermissionCommand.commandID,
      payload: {
        localIdentity: permission.id,
        foreignIdentity: role.id,
        isAssociated: true,
      },
    }, ctx)).rejects.toThrow("Not authorized to mutate Permission")
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([])
  })

  it("updates an Instrument public reference and tag set through generated CRUD", async () => {
    const permissions = [Permission.login, Permission.admin_instruments]
    const actor = createAuthorizationTestUser("normal", { id: 96, permissions })
    const originalGroup = {
      id: 54,
      publicId: "originalGroup001",
      name: "Brass",
      description: "",
      color: null,
      sortOrder: 1,
    }
    const nextGroup = {
      id: 55,
      publicId: "nextGroup0000001",
      name: "Woodwinds",
      description: "",
      color: null,
      sortOrder: 2,
    }
    const instrument = {
      id: 7,
      name: "Trumpet",
      description: "",
      autoAssignFileLeafRegex: null,
      sortOrder: 1,
      functionalGroupId: originalGroup.id,
      functionalGroup: originalGroup,
      instrumentTags: [],
    }
    const acousticTag = {
      id: 20,
      text: "Acoustic",
      description: "",
      sortOrder: 1,
      color: null,
      significance: null,
    }
    const electricTag = {
      id: 21,
      text: "Electric",
      description: "",
      sortOrder: 2,
      color: null,
      significance: "electricity",
    }
    authorizationTestDb.reset({
      user: [actor],
      instrumentFunctionalGroup: [originalGroup, nextGroup],
      instrument: [instrument],
      instrumentTag: [acousticTag, electricTag],
      instrumentTagAssociation: [{ id: 70, instrumentId: instrument.id, tagId: acousticTag.id }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.instrumentEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: instrument.id,
        patch: {
          name: "Cornet",
          functionalGroupId: nextGroup.publicId,
          instrumentTags: [electricTag.id],
        },
      },
    }, ctx)).resolves.toEqual({ identity: instrument.id })

    expect(authorizationTestDb.snapshot("instrument")).toEqual([
      expect.objectContaining({
        id: instrument.id,
        name: "Cornet",
        functionalGroupId: nextGroup.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("instrumentTagAssociation")).toEqual([
      expect.objectContaining({ instrumentId: instrument.id, tagId: electricTag.id }),
    ])
  })

  it("updates and soft-deletes a Song through generated CRUD", async () => {
    const permissions = [Permission.login, Permission.view_songs, Permission.manage_songs]
    const actor = createAuthorizationTestUser("normal", { id: 97, permissions })
    const visibility = {
      id: 3,
      name: Permission.visibility_public,
      description: "Public",
      isVisibility: true,
      sortOrder: 1,
      significance: null,
      color: null,
      iconName: null,
      roles: [],
    }
    const song = {
      id: 8,
      name: "Autumn Leaves",
      aliases: "",
      description: "",
      startBPM: null,
      endBPM: null,
      introducedYear: null,
      lengthSeconds: null,
      isDeleted: false,
      createdByUserId: actor.id,
      createdByUser: actor,
      visiblePermissionId: null,
      visiblePermission: null,
      tags: [],
    }
    const oldTag = {
      id: 20,
      text: "Old style",
      description: "",
      color: null,
      sortOrder: 1,
      significance: null,
      group: null,
      indicator: null,
      indicatorCssClass: null,
    }
    const jazzTag = {
      id: 21,
      text: "Jazz",
      description: "",
      color: null,
      sortOrder: 2,
      significance: null,
      group: "Style",
      indicator: null,
      indicatorCssClass: null,
    }
    authorizationTestDb.reset({
      user: [actor],
      permission: [visibility],
      song: [song],
      songTag: [oldTag, jazzTag],
      songTagAssociation: [{ id: 80, songId: song.id, tagId: oldTag.id }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.songEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: song.id,
        patch: {
          aliases: "Les Feuilles mortes",
          visiblePermissionId: visibility.id,
          tags: [jazzTag.id],
        },
      },
    }, ctx)).resolves.toEqual({ identity: song.id })

    expect(authorizationTestDb.snapshot("song")).toEqual([
      expect.objectContaining({
        id: song.id,
        aliases: "Les Feuilles mortes",
        visiblePermissionId: visibility.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("songTagAssociation")).toEqual([
      expect.objectContaining({ songId: song.id, tagId: jazzTag.id }),
    ])

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.songEditorView.crud.operations.delete.command.commandID,
      payload: { identity: song.id },
    }, ctx)).resolves.toEqual({ identity: song.id })
    expect(authorizationTestDb.snapshot("song")[0]).toMatchObject({
      id: song.id,
      isDeleted: true,
    })
  })

  it("updates User profile sets through generated create/update commands without adding generic deletion", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 98 })
    const target = createAuthorizationTestUser("normal", {
      id: 99,
      name: "Original user",
      email: "original@example.test",
    })
    const instrument = {
      id: 41,
      name: "Trumpet",
      description: "",
      sortOrder: 1,
      functionalGroupId: 1,
    }
    const userTag = {
      id: 42,
      text: "Band",
      description: "",
      sortOrder: 1,
      color: null,
      cssClass: null,
      significance: null,
    }
    authorizationTestDb.reset({
      user: [actor, target],
      instrument: [instrument],
      userTag: [userTag],
      userInstrument: [],
      userTagAssignment: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.userEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: target.id,
        patch: {
          name: "Updated user",
          phone: "+32 123",
          instruments: [instrument.id],
          tags: [userTag.id],
        },
      },
    }, ctx)).resolves.toEqual({ identity: target.id })

    expect(authorizationTestDb.snapshot("user")).toContainEqual(
      expect.objectContaining({ id: target.id, name: "Updated user", phone: "+32 123" }),
    )
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([
      expect.objectContaining({ userId: target.id, instrumentId: instrument.id }),
    ])
    expect(authorizationTestDb.snapshot("userTagAssignment")).toEqual([
      expect.objectContaining({ userId: target.id, userTagId: userTag.id }),
    ])
    expect(db3.getDB3CrudViewForCommand("User_Delete")).toBeUndefined()
  })

  it("updates WikiPage tag metadata through its update-only generated command", async () => {
    const permissions = [
      Permission.login,
      Permission.view_wiki_pages,
      Permission.edit_wiki_pages,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 105, permissions })
    const wikiPage = {
      id: 106,
      slug: "rehearsal-policy",
      namespace: null,
      createdByUserId: actor.id,
      visiblePermissionId: null,
    }
    const wikiPageTag = {
      id: 107,
      text: "Policy",
      description: "Policy page",
      color: null,
      sortOrder: 1,
      significance: "Policy",
    }
    authorizationTestDb.reset({
      user: [actor],
      wikiPage: [wikiPage],
      wikiPageTag: [wikiPageTag],
      wikiPageTagAssignment: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.wikiPageEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: wikiPage.id,
        patch: { tags: [wikiPageTag.id] },
      },
    }, ctx)).resolves.toEqual({ identity: wikiPage.id })

    expect(authorizationTestDb.snapshot("wikiPageTagAssignment")).toEqual([
      expect.objectContaining({
        wikiPageId: wikiPage.id,
        tagId: wikiPageTag.id,
      }),
    ])
    expect(db3.wikiPageEditorView.crud.operations.create).toBeUndefined()
    expect(db3.wikiPageEditorView.crud.operations.delete).toBeUndefined()
  })

  it("updates an Event row and tag set through generated CRUD", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 100 })
    const eventTag = {
      id: 51,
      text: "Public",
      description: "",
      sortOrder: 1,
      color: null,
      significance: null,
      visibleOnFrontpage: true,
    }
    const event = makeEvent({
      id: 101,
      locationURL: "",
      durationMillis: BigInt(0),
      isAllDay: false,
      statusId: null,
      segmentBehavior: null,
    })
    authorizationTestDb.reset({
      user: [actor],
      permission: [publicVisibility],
      event: [event],
      eventTag: [eventTag],
      eventTagAssignment: [],
      eventSegment: [],
      eventStatus: [],
      setting: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.eventEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: event.id,
        patch: {
          locationDescription: "Main hall",
          segmentBehavior: "Sets",
          tags: [eventTag.id],
        },
      },
    }, ctx)).resolves.toEqual({ identity: event.id })

    expect(authorizationTestDb.snapshot("event")).toEqual([
      expect.objectContaining({
        id: event.id,
        locationDescription: "Main hall",
        segmentBehavior: "Sets",
      }),
    ])
    expect(authorizationTestDb.snapshot("eventTagAssignment")).toEqual([
      expect.objectContaining({ eventId: event.id, eventTagId: eventTag.id }),
    ])
  })

  it("updates File metadata and tags while rejecting storage-field changes through generated CRUD", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 102 })
    const fileTag = {
      id: 61,
      text: "Chart",
      description: "",
      sortOrder: 1,
      color: null,
      significance: null,
    }
    const file = {
      id: 62,
      fileLeafName: "old-name.pdf",
      storedLeafName: "server-storage-id.pdf",
      description: "",
      isDeleted: false,
      uploadedAt: new Date("2026-09-20T10:00:00.000Z"),
      uploadedByUserId: actor.id,
      visiblePermissionId: publicVisibility.id,
      sizeBytes: 123,
      mimeType: "application/pdf",
      customData: null,
    }
    authorizationTestDb.reset({
      user: [actor],
      permission: [publicVisibility],
      file: [file],
      fileTag: [fileTag],
      fileTagAssignment: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.fileEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: file.id,
        patch: {
          fileLeafName: "new-name.pdf",
          description: "Program",
          tags: [fileTag.id],
        },
      },
    }, ctx)).resolves.toEqual({ identity: file.id })

    expect(authorizationTestDb.snapshot("file")).toEqual([
      expect.objectContaining({
        id: file.id,
        fileLeafName: "new-name.pdf",
        storedLeafName: "server-storage-id.pdf",
        description: "Program",
      }),
    ])
    expect(authorizationTestDb.snapshot("fileTagAssignment")).toEqual([
      expect.objectContaining({ fileId: file.id, fileTagId: fileTag.id }),
    ])

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.fileEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: file.id,
        patch: { storedLeafName: "forged.pdf" },
      },
    }, ctx)).rejects.toThrow("Not authorized to mutate File fields: storedLeafName")
  })

  it("updates and hard-deletes Custom Link and Menu Link rows through generated CRUD", async () => {
    const permissions = [
      Permission.login,
      Permission.view_custom_links,
      Permission.manage_custom_links,
      Permission.customize_menu,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 103, permissions })
    const customLink = {
      id: 70,
      name: "Scores",
      description: "Old description",
      slug: "scores",
      destinationURL: "https://example.test/scores",
      redirectType: "Temporary",
      intermediateMessage: null,
      forwardQuery: true,
      createdByUserId: actor.id,
      createdAt: new Date("2026-09-21T10:00:00.000Z"),
    }
    const menuLink = {
      id: 71,
      sortOrder: 3,
      realm: "General",
      applicationPage: null,
      groupName: "Resources",
      groupCssClass: "resources",
      itemCssClass: "scores",
      linkType: "ExternalURL",
      externalURI: "https://example.test/scores",
      wikiSlug: null,
      iconName: "Link",
      caption: "Scores",
      visiblePermissionId: null,
      createdByUserId: actor.id,
      createdAt: new Date("2026-09-21T10:00:00.000Z"),
    }
    authorizationTestDb.reset({
      user: [actor],
      customLink: [customLink],
      menuLink: [menuLink],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.customLinkEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: customLink.id,
        patch: { description: "Updated description", forwardQuery: false },
      },
    }, ctx)).resolves.toEqual({ identity: customLink.id })
    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.menuLinkEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: menuLink.id,
        patch: { caption: "Updated scores" },
      },
    }, ctx)).resolves.toEqual({ identity: menuLink.id })

    expect(authorizationTestDb.snapshot("customLink")[0]).toMatchObject({
      id: customLink.id,
      description: "Updated description",
      forwardQuery: false,
    })
    expect(authorizationTestDb.snapshot("menuLink")[0]).toMatchObject({
      id: menuLink.id,
      caption: "Updated scores",
      sortOrder: 3,
    })

    await invokeResolver(executeDB3CommandMutation, {
      commandID: db3.customLinkEditorView.crud.operations.delete.command.commandID,
      payload: { identity: customLink.id },
    }, ctx)
    await invokeResolver(executeDB3CommandMutation, {
      commandID: db3.menuLinkEditorView.crud.operations.delete.command.commandID,
      payload: { identity: menuLink.id },
    }, ctx)
    expect(authorizationTestDb.snapshot("customLink")).toEqual([])
    expect(authorizationTestDb.snapshot("menuLink")).toEqual([])
  })

  it("revalidates command DTOs and enforces server-side entity authorization", async () => {
    const permissions = [Permission.login, Permission.view_events]
    const actor = createAuthorizationTestUser("normal", { id: 92, permissions })
    authorizationTestDb.reset({
      user: [actor],
      event: [makeEvent({ id: 100 })],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const payload = {
      eventId: 100,
      name: "Setlist",
      description: "",
      isActuallyPlayed: false,
      isOrdered: true,
      sortOrder: 0,
      songs: [],
      dividers: [],
    }

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.saveEventSongListCommand.commandID,
      payload: { ...payload, unexpected: true },
    }, ctx)).rejects.toThrow("Unrecognized key")

    await expect(invokeResolver(executeDB3CommandMutation, {
      commandID: db3.saveEventSongListCommand.commandID,
      payload,
    }, ctx)).rejects.toThrow("Not authorized to mutate EventSongList")
  })

  it("saves an authorized setlist aggregate through the command dispatcher", async () => {
    const permissions = [
      Permission.login,
      Permission.manage_events,
      Permission.view_events_nonpublic,
      Permission.view_songs,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 93, permissions })
    authorizationTestDb.reset({
      user: [actor],
      event: [makeEvent({ id: 100 })],
      song: [{
        id: 300,
        name: "Visible song",
        description: "",
        aliases: "",
        isDeleted: false,
        createdByUserId: actor.id,
        visiblePermissionId: publicVisibility.id,
      }],
      eventSongList: [],
      eventSongListSong: [],
      eventSongListDivider: [],
      eventSegment: [],
      eventStatus: [],
      setting: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    const result = await invokeResolver(executeDB3CommandMutation, {
      commandID: db3.saveEventSongListCommand.commandID,
      payload: {
        eventId: 100,
        name: "Setlist",
        description: "",
        isActuallyPlayed: false,
        isOrdered: true,
        sortOrder: 0,
        songs: [{ songId: 300, sortOrder: 0, subtitle: "Open quietly" }],
        dividers: [{
          sortOrder: 1,
          color: null,
          isInterruption: true,
          subtitleIfSong: null,
          isSong: false,
          lengthSeconds: null,
          textStyle: null,
          subtitle: "Break",
        }],
      },
    }, ctx)

    expect(result).toEqual({ id: 1 })
    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({ id: 1, eventId: 100, name: "Setlist" }),
    ])
    expect(authorizationTestDb.snapshot("eventSongListSong")).toEqual([
      expect.objectContaining({ eventSongListId: 1, songId: 300, sortOrder: 0 }),
    ])
    expect(authorizationTestDb.snapshot("eventSongListDivider")).toEqual([
      expect.objectContaining({ eventSongListId: 1, subtitle: "Break", sortOrder: 1 }),
    ])

    const updateResult = await invokeResolver(executeDB3CommandMutation, {
      commandID: db3.saveEventSongListCommand.commandID,
      payload: {
        id: 1,
        eventId: 100,
        name: "Updated setlist",
        description: "Second pass",
        isActuallyPlayed: true,
        isOrdered: true,
        sortOrder: 2,
        songs: [],
        dividers: [{
          id: 1,
          sortOrder: 0,
          color: null,
          isInterruption: false,
          subtitleIfSong: "Optional tune",
          isSong: true,
          lengthSeconds: 90,
          textStyle: null,
          subtitle: "Encore",
        }],
      },
    }, ctx)

    expect(updateResult).toEqual({ id: 1 })
    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({
        id: 1,
        eventId: 100,
        name: "Updated setlist",
        description: "Second pass",
        isActuallyPlayed: true,
        sortOrder: 2,
      }),
    ])
    expect(authorizationTestDb.snapshot("eventSongListSong")).toEqual([])
    expect(authorizationTestDb.snapshot("eventSongListDivider")).toEqual([
      expect.objectContaining({
        id: 1,
        eventSongListId: 1,
        subtitle: "Encore",
        subtitleIfSong: "Optional tune",
        isSong: true,
        isInterruption: false,
        lengthSeconds: 90,
        sortOrder: 0,
      }),
    ])
  })
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
    const profilePermissions = [Permission.login, Permission.manage_users]
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
    const ordinaryPermissions = [Permission.login, Permission.manage_users]
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
