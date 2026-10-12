import { authorizationPermissionId } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { eventPublicId, segmentPublicId, segmentResponsePublicId, eventResponsePublicId } from "../support/eventResponseFixtures";
import { attendancePublicId } from "../support/eventAttendanceFixtures";
import { songPublicId } from "../support/songFixtures";
import { filePublicId } from "../support/fileFixtures";
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
import { listPublicId, listSongPublicId } from "../support/eventSongListFixtures"
import updateUserEventAttendance from "src/core/db3/mutations/updateUserEventAttendanceMutation"
import { Permission } from "shared/permissions"
import { isPublicId, parsePublicId } from "shared/publicId"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3PublicUpdate } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"
import { bandInstrumentView } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts"
import { bandUserTagView } from "src/core/db3/shared/entities/user/bandUserTagViews"

const attendanceBandPublicId = authorizationBandId;

const publicVisibility = {
  id: authorizationPermissionId(Permission.visibility_public), // Matches the inherited public-role grant in the database fixture.
  publicId: parsePublicId<"Permission">("PublicVisPerm002"),
  name: Permission.visibility_public,
  roles: [],
}

const membersVisibility = {
  id: 701,
  publicId: parsePublicId<"Permission">("MemberVisPerm701"),
  name: Permission.visibility_members,
  roles: [],
}

const makeEvent = (overrides: Record<string, unknown> = {}) => {
  const id = typeof overrides.id === "number" ? overrides.id : 100
  return { bandId: 1,
    id,
    publicId: eventPublicId(id),
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
  }
}

describe("DB3 command boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthorizationDatabase({ change: [] })
  })

  it("rejects unknown command IDs at the registered server boundary", async () => {
    const permissions = [Permission.login]
    const actor = createAuthorizationTestUser("normal", { id: 91, permissions })
    resetAuthorizationDatabase({ user: [actor], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: "Missing_Command",
      payload: {},
    }, ctx)).rejects.toThrow("Unknown DB3 command 'Missing_Command'")
  })

  it("updates an Instrument public reference through generated CRUD", async () => {
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
      publicId: "instrmnt00000001",
      nameId: null,
      descriptionId: null,
      autoAssignFileLeafRegex: null,
      sortOrder: 1,
      functionalGroupId: originalGroup.id,
      functionalGroup: originalGroup,
    }
    resetAuthorizationDatabase({
      user: [actor],
      bandInstrumentFunctionalGroup: [originalGroup, nextGroup].map(group => ({ ...group, bandId: 1, isHidden: false, globalFunctionalGroupId: null })),
      bandInstrument: [{ ...instrument, functionalGroup: undefined, bandId: 1, isHidden: false, globalInstrumentId: null }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.instrumentEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: instrument.publicId,
        patch: {
          name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Cornet" },
          functionalGroupId: nextGroup.publicId,
        },
      },
    }, ctx)).resolves.toEqual({ identity: instrument.publicId })

    expect(authorizationTestDb.snapshot("bandInstrument")).toEqual([
      expect.objectContaining({
        id: instrument.id,
        functionalGroupId: nextGroup.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("bandDynamicLocalizedStringValue")).toContainEqual(expect.objectContaining({ indexedValue: "Cornet" }))
  })

  it("updates and soft-deletes a Song through generated CRUD", async () => {
    const permissions = [Permission.login, Permission.view_songs, Permission.manage_songs]
    const actor = createAuthorizationTestUser("normal", { id: 97, permissions })
    const visibility = {
      id: 3,
      publicId: parsePublicId<"Permission">("SongVisPerm00003"),
      name: Permission.visibility_public,
      description: "Public",
      isVisibility: true,
      sortOrder: 1,
      significance: null,
      color: null,
      iconName: null,
      roles: [],
    }
    const song = { bandId: 1,
      id: 8,
      publicId: songPublicId(8),
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
      publicId: "OldStyleTag00001",
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
      publicId: "JazzStyleTag0001",
      text: "Jazz",
      description: "",
      color: null,
      sortOrder: 2,
      significance: null,
      group: "Style",
      indicator: null,
      indicatorCssClass: null,
    }
    resetAuthorizationDatabase({
      user: [actor],
      permission: [visibility],
      song: [song],
      bandSongTag: [oldTag, jazzTag].map(tag => ({ ...tag, bandId: 1, isHidden: false, globalSongTagId: null })),
      bandSongTagAssociation: [{
        id: 80,
        publicId: "OriginalSongAs01",
        songId: song.id,
        bandSongTagId: oldTag.id,
      }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.songEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: song.publicId,
        patch: {
          aliases: "Les Feuilles mortes",
          visiblePermissionId: visibility.publicId,
          tags: [jazzTag.publicId],
        },
      },
    }, ctx)).resolves.toEqual({ identity: song.publicId })

    expect(authorizationTestDb.snapshot("song")).toEqual([
      expect.objectContaining({
        id: song.id,
        aliases: "Les Feuilles mortes",
        visiblePermissionId: visibility.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("bandSongTagAssociation")).toEqual([
      expect.objectContaining({ songId: song.id, bandSongTagId: jazzTag.id }),
    ])

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.songEditorView.crud.operations.delete.command.commandID,
      payload: { identity: song.publicId },
    }, ctx)).resolves.toEqual({ identity: song.publicId })
    expect(authorizationTestDb.snapshot("song")[0]).toMatchObject({
      id: song.id,
      isDeleted: true,
    })
  })

  it("updates the owner's shared User fields without generic assignment writes or deletion", async () => {
    const target = createAuthorizationTestUser("normal", {
      id: 99, name: "Original user", email: "original@example.test",
    })
    resetAuthorizationDatabase({
      user: [{ ...target, globalRoleId: null, mergedIntoUserId: null }],
      permission: [{ id: 1, name: Permission.login, isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: target.id })
    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: null,
      commandID: db3.userEditorView.crud.operations.update.command.commandID,
      payload: { identity: target.publicId, patch: { name: "Updated user", phone: "+32 123" } },
    }, ctx)).resolves.toEqual({ identity: target.publicId })
    expect(authorizationTestDb.snapshot("user")).toContainEqual(
      expect.objectContaining({ id: target.id, name: "Updated user", phone: "+32 123" }),
    )
    expect(db3.getDB3CrudViewForCommand("User_Delete")).toBeUndefined()
  })

  it("updates WikiPage tag metadata through its update-only generated command", async () => {
    const permissions = [
      Permission.login,
      Permission.view_wiki_pages,
      Permission.edit_wiki_pages,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 105, permissions })
    const wikiPage = { bandId: 1,
      id: 106,
      publicId: parsePublicId<"WikiPage">("WikiPagePublic01"),
      slug: "rehearsal-policy",
      namespace: null,
      createdByUserId: actor.id,
      visiblePermissionId: null,
    }
    const wikiPageTag = {
      id: 107,
      publicId: "WikiTagPublic001",
      text: "Policy",
      description: "Policy page",
      color: null,
      sortOrder: 1,
      significance: "Policy",
    }
    resetAuthorizationDatabase({
      user: [actor],
      wikiPage: [wikiPage],
      bandWikiPageTag: [{ ...wikiPageTag, bandId: 1, isHidden: false }],
      wikiPageTagAssignment: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.wikiPageEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: wikiPage.publicId,
        patch: { tags: [wikiPageTag.publicId] },
      },
    }, ctx)).resolves.toEqual({ identity: wikiPage.publicId })

    expect(authorizationTestDb.snapshot("wikiPageTagAssignment")).toEqual([
      expect.objectContaining({
        wikiPageId: wikiPage.id,
        bandWikiPageTagId: wikiPageTag.id,
        publicId: expect.any(String),
      }),
    ])
    expect(isPublicId(authorizationTestDb.snapshot("wikiPageTagAssignment")[0]?.publicId)).toBe(true)
    expect(db3.wikiPageEditorView.crud.operations.create).toBeUndefined()
    expect(db3.wikiPageEditorView.crud.operations.delete).toBeUndefined()
  })

  it("updates an Event row and tag set through generated CRUD", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 100 })
    const eventTagPublicId = parsePublicId<"EventTag">("EventTagPublic01")
    const eventTag = {
      id: 51,
      publicId: eventTagPublicId,
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
    })
    resetAuthorizationDatabase({
      user: [actor],
      permission: [publicVisibility],
      event: [event],
      bandEventTag: [{ ...eventTag, bandId: 1, isHidden: false, globalEventTagId: null }],
      eventTagAssignment: [],
      eventSegment: [],
      eventStatus: [],
      setting: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.eventEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: event.publicId,
        patch: {
          locationDescription: "Main hall",
          tags: [eventTag.publicId],
        },
      },
    }, ctx)).resolves.toEqual({ identity: event.publicId })

    expect(authorizationTestDb.snapshot("event")).toEqual([
      expect.objectContaining({
        id: event.id,
        locationDescription: "Main hall",
      }),
    ])
    expect(authorizationTestDb.snapshot("eventTagAssignment")).toEqual([
      expect.objectContaining({
        eventId: event.id,
        bandEventTagId: eventTag.id,
        publicId: expect.any(String),
      }),
    ])
    expect(isPublicId(authorizationTestDb.snapshot("eventTagAssignment")[0]?.publicId)).toBe(true)
  })

  it("updates File metadata and tags while rejecting storage-field changes through generated CRUD", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 102 })
    const fileTagPublicId = parsePublicId<"FileTag">("FileTagPublic001")
    const fileTag = {
      id: 61,
      publicId: fileTagPublicId,
      text: "Chart",
      description: "",
      sortOrder: 1,
      color: null,
      significance: null,
    }
    const file = { bandId: 1,
      id: 62,
      publicId: filePublicId(62),
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
    resetAuthorizationDatabase({
      user: [actor],
      permission: [publicVisibility],
      file: [file],
      bandFileTag: [{ ...fileTag, bandId: 1, isHidden: false, globalFileTagId: null }],
      bandFileTagAssignment: [],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: actor.id })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.fileEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: file.publicId,
        patch: {
          fileLeafName: "new-name.pdf",
          description: "Program",
          tags: [fileTag.publicId],
        },
      },
    }, ctx)).resolves.toEqual({ identity: file.publicId })

    expect(authorizationTestDb.snapshot("file")).toEqual([
      expect.objectContaining({
        id: file.id,
        fileLeafName: "new-name.pdf",
        storedLeafName: "server-storage-id.pdf",
        description: "Program",
      }),
    ])
    expect(authorizationTestDb.snapshot("bandFileTagAssignment")).toEqual([
      expect.objectContaining({
        fileId: file.id,
        bandFileTagId: fileTag.id,
        publicId: expect.any(String),
      }),
    ])
    expect(isPublicId(authorizationTestDb.snapshot("bandFileTagAssignment")[0]?.publicId)).toBe(true)

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.fileEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: file.publicId,
        patch: { storedLeafName: "forged.pdf" },
      },
    }, ctx)).rejects.toThrow("storedLeafName")
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
      bandId: 1,
      fileId: null,
      publicId: parsePublicId<"CustomLink">("CustomLinkTest01"),
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
    const menuLink = { bandId: 1,
      id: 71,
      publicId: parsePublicId<"MenuLink">("MenuLinkTest0001"),
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
    resetAuthorizationDatabase({
      user: [actor],
      customLink: [customLink],
      menuLink: [menuLink],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.customLinkEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: customLink.publicId,
        patch: { description: "Updated description", forwardQuery: false },
      },
    }, ctx)).resolves.toEqual({ identity: customLink.publicId })
    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.menuLinkEditorView.crud.operations.update.command.commandID,
      payload: {
        identity: menuLink.publicId,
        patch: { caption: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Updated scores" } },
      },
    }, ctx)).resolves.toEqual({ identity: menuLink.publicId })

    expect(authorizationTestDb.snapshot("customLink")[0]).toMatchObject({
      id: customLink.id,
      description: "Updated description",
      forwardQuery: false,
    })
    expect(authorizationTestDb.snapshot("menuLink")[0]).toMatchObject({
      id: menuLink.id,
      sortOrder: 3,
    })
    expect(authorizationTestDb.snapshot("bandDynamicLocalizedStringValue")).toContainEqual(
      expect.objectContaining({ indexedValue: "Updated scores" }),
    )

    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.customLinkEditorView.crud.operations.delete.command.commandID,
      payload: { identity: customLink.publicId },
    }, ctx)
    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.menuLinkEditorView.crud.operations.delete.command.commandID,
      payload: { identity: menuLink.publicId },
    }, ctx)
    expect(authorizationTestDb.snapshot("customLink")).toEqual([])
    expect(authorizationTestDb.snapshot("menuLink")).toEqual([])
  })

  it("revalidates command DTOs and enforces server-side entity authorization", async () => {
    const permissions = [Permission.login, Permission.view_events]
    const actor = createAuthorizationTestUser("normal", { id: 92, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 })],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const payload = {
      eventId: eventPublicId(100),
      name: "Setlist",
      description: "",
      isActuallyPlayed: false,
      isOrdered: true,
      sortOrder: 0,
      songs: [],
      dividers: [],
    }

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.saveEventSongListCommand.commandID,
      payload: { ...payload, unexpected: true },
    }, ctx)).rejects.toThrow("Unrecognized key")

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
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
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 })],
      song: [{ bandId: 1,
        id: 300,
        publicId: songPublicId(300),
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

    const result = await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.saveEventSongListCommand.commandID,
      payload: {
        eventId: eventPublicId(100),
        name: "Setlist",
        description: "",
        isActuallyPlayed: false,
        isOrdered: true,
        sortOrder: 0,
        songs: [{ songId: songPublicId(300), sortOrder: 0, subtitle: "Open quietly" }],
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

    expect(result).toEqual({ publicId: expect.any(String) })
    expect(isPublicId(db3.saveEventSongListCommand.parseResult(result).publicId)).toBe(true)
    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({ id: 1, eventId: 100, name: "Setlist" }),
    ])
    expect(authorizationTestDb.snapshot("eventSongListSong")).toEqual([
      expect.objectContaining({ eventSongListId: 1, songId: 300, sortOrder: 0 }),
    ])
    expect(authorizationTestDb.snapshot("eventSongListDivider")).toEqual([
      expect.objectContaining({ eventSongListId: 1, subtitle: "Break", sortOrder: 1 }),
    ])

    const updateResult = await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.saveEventSongListCommand.commandID,
      payload: {
        publicId: db3.saveEventSongListCommand.parseResult(result).publicId,
        eventId: eventPublicId(100),
        name: "Updated setlist",
        description: "Second pass",
        isActuallyPlayed: true,
        isOrdered: true,
        sortOrder: 2,
        songs: [],
        dividers: [{
          publicId: authorizationTestDb.snapshot("eventSongListDivider")[0]!.publicId,
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

    expect(updateResult).toEqual(result)
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

describe("public-ID reorder authorization", () => {
  const menuLinkPublicId = (id: number) => parsePublicId<"MenuLink">(`MenuLinkTest${id.toString().padStart(4, "0")}`)

  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthorizationDatabase({ change: [] })
  })

  it("uses fresh grants and stops before reading reorder targets", async () => {
    const sessionPermissions = [Permission.login, Permission.customize_menu]
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 3,
      permissions: [Permission.login],
    })
    resetAuthorizationDatabase({
      user: [databaseActor],
      menuLink: [
        { id: 1, publicId: menuLinkPublicId(1), caption: "A", sortOrder: 0, createdByUserId: databaseActor.id },
        { id: 2, publicId: menuLinkPublicId(2), caption: "B", sortOrder: 1, createdByUserId: databaseActor.id },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: sessionPermissions,
    })
    const targetLookup = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "findMany")

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderMenuLinksCommand.commandID,
      payload: {
        movingItemId: menuLinkPublicId(1),
        newPositionItemId: menuLinkPublicId(2),
        scopeRowIds: [menuLinkPublicId(1), menuLinkPublicId(2)],
      },
    }, ctx)).rejects.toThrow("Not authorized to mutate MenuLink fields: sortOrder")

    expect(targetLookup).not.toHaveBeenCalled()
  })

  it("preflights every changed row before writing the first sort order", async () => {
    const permissions = [Permission.login, Permission.customize_menu]
    const actor = createAuthorizationTestUser("normal", { id: 4, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      menuLink: [1, 2, 3].map((id, index) => ({ bandId: 1,
        id,
        publicId: menuLinkPublicId(id),
        caption: `Link ${id}`,
        sortOrder: index,
        createdByUserId: actor.id,
        visiblePermissionId: publicVisibility.id,
        visiblePermission: publicVisibility,
      })),
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const authorize = db3.xMenuLink.authorizeAndSanitize.bind(db3.xMenuLink)
    vi.spyOn(db3.xMenuLink, "authorizeAndSanitize").mockImplementation(args => {
      const result = authorize(args)
      return args.rowMode === "update" && args.existingModel?.id === 2
        ? { ...result, rowIsAuthorized: false }
        : result
    })
    const update = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "update")

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderMenuLinksCommand.commandID,
      payload: {
        movingItemId: menuLinkPublicId(3),
        newPositionItemId: menuLinkPublicId(1),
        scopeRowIds: [menuLinkPublicId(1), menuLinkPublicId(2), menuLinkPublicId(3)],
      },
    }, ctx)).rejects.toThrow("Not authorized to mutate MenuLink fields: sortOrder")

    expect(update).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("reorders only the caller-supplied scope and preserves out-of-scope slots", async () => {
    const permissions = [Permission.login, Permission.customize_menu]
    const actor = createAuthorizationTestUser("normal", { id: 5, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      menuLink: [
        { bandId: 1, id: 1, publicId: menuLinkPublicId(1), caption: "A", sortOrder: 0, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { bandId: 1, id: 2, publicId: menuLinkPublicId(2), caption: "Hidden", sortOrder: 1, createdByUserId: actor.id, visiblePermissionId: membersVisibility.id, visiblePermission: membersVisibility },
        { bandId: 1, id: 3, publicId: menuLinkPublicId(3), caption: "B", sortOrder: 2, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { bandId: 1, id: 4, publicId: menuLinkPublicId(4), caption: "C", sortOrder: 3, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const targetLookup = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "findMany")

    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderMenuLinksCommand.commandID,
      payload: {
        movingItemId: menuLinkPublicId(4),
        newPositionItemId: menuLinkPublicId(1),
        scopeRowIds: [menuLinkPublicId(1), menuLinkPublicId(3), menuLinkPublicId(4)],
      },
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
    resetAuthorizationDatabase({
      user: [actor],
      menuLink: [
        { bandId: 1, id: 1, publicId: menuLinkPublicId(1), caption: "Visible", sortOrder: 0, createdByUserId: actor.id, visiblePermissionId: publicVisibility.id, visiblePermission: publicVisibility },
        { bandId: 1, id: 2, publicId: menuLinkPublicId(2), caption: "Hidden", sortOrder: 1, createdByUserId: actor.id, visiblePermissionId: membersVisibility.id, visiblePermission: membersVisibility },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const update = vi.spyOn(authorizationTestDb.getDelegate("menuLink"), "update")

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderMenuLinksCommand.commandID,
      payload: {
        movingItemId: menuLinkPublicId(1),
        newPositionItemId: menuLinkPublicId(2),
        scopeRowIds: [menuLinkPublicId(1), menuLinkPublicId(2)],
      },
    }, ctx)).rejects.toThrow("MenuLink was not found")

    expect(update).not.toHaveBeenCalled()
  })

  it("rejects a scope row outside the declared ordering group", async () => {
    const permissions = [Permission.login, Permission.manage_events, Permission.view_events_nonpublic]
    const actor = createAuthorizationTestUser("normal", { id: 7, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 }), makeEvent({ id: 200 }), makeEvent({ id: 647 })],
      eventSongList: [
        { id: 1, publicId: listPublicId(1), eventId: 100, name: "A", description: "", sortOrder: 0 },
        { id: 2, publicId: listPublicId(2), eventId: 200, name: "Other group", description: "", sortOrder: 1 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const update = vi.spyOn(authorizationTestDb.getDelegate("eventSongList"), "update")

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderEventSongListsCommand.commandID,
      payload: {
        movingItemId: listPublicId(1),
        newPositionItemId: listPublicId(2),
        scopeRowIds: [listPublicId(1), listPublicId(2)],
        eventId: eventPublicId(100),
      },
    }, ctx)).rejects.toThrow("Setlist reorder scope was not found in this event")

    expect(update).not.toHaveBeenCalled()
  })

  it("reorders an authorized group without touching another group", async () => {
    const permissions = [
      Permission.login,
      Permission.manage_events,
      Permission.view_events_nonpublic,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 5, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 }), makeEvent({ id: 200 }), makeEvent({ id: 647 })],
      eventSongList: [
        { id: 1, publicId: listPublicId(1), eventId: 100, name: "A", description: "", sortOrder: 0 },
        { id: 2, publicId: listPublicId(2), eventId: 100, name: "B", description: "", sortOrder: 1 },
        { id: 3, publicId: listPublicId(3), eventId: 200, name: "Other", description: "", sortOrder: 7 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderEventSongListsCommand.commandID,
      payload: {
        movingItemId: listPublicId(1),
        newPositionItemId: listPublicId(2),
        scopeRowIds: [listPublicId(1), listPublicId(2)],
        eventId: eventPublicId(100),
      },
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSongList")).toEqual([
      expect.objectContaining({ id: 1, sortOrder: 1 }),
      expect.objectContaining({ id: 2, sortOrder: 0 }),
      expect.objectContaining({ id: 3, sortOrder: 7 }),
    ])
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({ table: "EventSongList", action: "update" }),
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
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 }), makeEvent({ id: 200 }), makeEvent({ id: 647 })],
      eventSongList: [
        { id: 650, publicId: listPublicId(650), eventId: 647, name: "Setlist", description: "", sortOrder: 0 },
        { id: 651, publicId: listPublicId(651), eventId: 647, name: "Set 2", description: "", sortOrder: 0 },
      ],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId,
      commandID: db3.reorderEventSongListsCommand.commandID,
      payload: {
        movingItemId: listPublicId(650),
        newPositionItemId: listPublicId(651),
        scopeRowIds: [listPublicId(650), listPublicId(651)],
        eventId: eventPublicId(647),
      },
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
    resetAuthorizationDatabase({ change: [] })
  })

  it("requires fresh manage-events authority before target lookup", async () => {
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 10,
      permissions: [Permission.login],
    })
    resetAuthorizationDatabase({ user: [databaseActor], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: [Permission.login, Permission.manage_events],
    })
    const targetLookup = vi.spyOn(
      authorizationTestDb.getDelegate("eventSongList"),
      "findFirst",
    )

    await expect(invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId, commandID: db3.deleteEventSongListCommand.commandID, payload: { publicId: listPublicId(20) } }, ctx)).rejects.toThrow(
      "Not authorized to mutate EventSongList fields: publicId",
    )
    expect(targetLookup).not.toHaveBeenCalled()
  })

  it("deletes an authorized list and its children in one audited operation", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 11, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent({ id: 100 }), makeEvent({ id: 200 }), makeEvent({ id: 647 })],
      eventSongList: [{
        id: 20,
        publicId: listPublicId(20),
        eventId: 100,
        name: "Setlist",
        description: "",
        isActuallyPlayed: false,
        isOrdered: true,
        sortOrder: 0,
      }],
      eventSongListSong: [{
        id: 21,
        publicId: listSongPublicId(21),
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

    await invokeResolver(executeDB3CommandMutation, { bandPublicId: authorizationBandId, commandID: db3.deleteEventSongListCommand.commandID, payload: { publicId: listPublicId(20) } }, ctx)

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
    resetAuthorizationDatabase({ change: [] })
  })

  it("lets a responder create only their own event and segment responses", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 30, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent()],
      eventSegment: [{ id: 101, publicId: segmentPublicId(101), eventId: 100, startsAt: null, durationMillis: BigInt(0), isAllDay: false, dateTimeVersion: 2 }],
      eventSegmentUserResponse: [],
      eventUserResponse: [],
      eventStatus: [],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: actor.publicId,
      eventId: eventPublicId(100),
      comment: "I will be there",
      segmentResponses: { [segmentPublicId(101)]: { attendanceId: attendancePublicId(2) } },
    }, ctx)

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([
      expect.objectContaining({
        bandUserId: actor.id,
        eventSegmentId: 101,
        attendanceId: 2,
        createdByUserId: actor.id,
      }),
    ])
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([
      expect.objectContaining({
        bandUserId: actor.id,
        eventId: 100,
        userComment: "I will be there",
      }),
    ])
  })

  it("rejects a forged other-user response before event lookup", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 31, permissions })
    const target = createAuthorizationTestUser("normal", { id: 32 })
    resetAuthorizationDatabase({ user: [actor, target], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: target.publicId,
      eventId: eventPublicId(100),
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
    resetAuthorizationDatabase({ user: [databaseActor, target], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: [Permission.login, Permission.change_others_event_responses],
    })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: target.publicId,
      eventId: eventPublicId(100),
      comment: "Stale grant",
    }, ctx)).rejects.toThrow(`required: ${Permission.change_others_event_responses}`)

    expect(eventLookup).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("uses change-others authority independently of manage-events", async () => {
    const permissions = [Permission.login, Permission.change_others_event_responses]
    const actor = createAuthorizationTestUser("normal", { id: 33, permissions })
    const target = createAuthorizationTestUser("normal", { id: 34 })
    resetAuthorizationDatabase({
      user: [actor, target],
      event: [makeEvent()],
      eventSegment: [{ id: 101, publicId: segmentPublicId(101), eventId: 100, startsAt: null, durationMillis: BigInt(0), isAllDay: false, dateTimeVersion: 2 }],
      eventSegmentUserResponse: [{
        id: 201, publicId: segmentResponsePublicId(201),
        bandUserId: target.id,
        eventSegmentId: 101,
        attendanceId: null,
      }],
      eventUserResponse: [{
        id: 202, publicId: eventResponsePublicId(202),
        bandUserId: target.id,
        eventId: 100,
        revision: 1,
        userComment: "",
        instrumentId: null,
        isInvited: false,
      }],
      eventStatus: [],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: target.publicId,
      eventId: eventPublicId(100),
      comment: "Updated by delegate",
      segmentResponses: { [segmentPublicId(101)]: { attendanceId: attendancePublicId(2) } },
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
    resetAuthorizationDatabase({ user: [actor], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: actor.publicId,
      eventId: eventPublicId(100),
      isInvited: true,
    }, ctx)).rejects.toThrow(`required: ${Permission.manage_events}`)

    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("allows manage-events to invite another user without response-edit authority", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 44, permissions })
    const target = createAuthorizationTestUser("normal", { id: 45 })
    resetAuthorizationDatabase({
      user: [actor, target],
      event: [makeEvent()],
      eventUserResponse: [],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: target.publicId,
      eventId: eventPublicId(100),
      isInvited: true,
    }, ctx)

    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([
      expect.objectContaining({
        bandUserId: target.id,
        eventId: 100,
        isInvited: true,
      }),
    ])
  })

  it("rejects segment IDs outside the declared event before any response write", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 36, permissions })
    resetAuthorizationDatabase({
      user: [actor],
      event: [makeEvent()],
      eventSegment: [{ id: 102, publicId: segmentPublicId(102), eventId: 999 }],
      eventSegmentUserResponse: [],
      eventUserResponse: [],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: actor.publicId,
      eventId: eventPublicId(100),
      segmentResponses: { [segmentPublicId(102)]: { attendanceId: attendancePublicId(2) } },
    }, ctx)).rejects.toThrow()

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([])
    expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([])
  })

  it("rejects malformed segment identifiers at the request boundary", async () => {
    const permissions = [Permission.login, Permission.respond_to_events]
    const actor = createAuthorizationTestUser("normal", { id: 43, permissions })
    resetAuthorizationDatabase({ user: [actor], event: [makeEvent()], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const eventLookup = vi.spyOn(authorizationTestDb.getDelegate("event"), "findFirst")

    await expect(invokeResolver(updateUserEventAttendance, {
      bandPublicId: attendanceBandPublicId,
      userId: actor.publicId,
      eventId: eventPublicId(100),
      segmentResponses: { "101suffix": { attendanceId: attendancePublicId(2) } },
    } as never, ctx)).rejects.toThrow("Invalid event segment ID")

    expect(eventLookup).not.toHaveBeenCalled()
  })

  it("does not let generic inserts bypass the self-versus-other boundary", async () => {
    const permissions = [Permission.login, Permission.respond_to_events, Permission.view_users_basic_info, Permission.view_events_nonpublic]
    const actor = createAuthorizationTestUser("normal", { id: 37, permissions })
    const target = createAuthorizationTestUser("normal", { id: 38 })
    resetAuthorizationDatabase({
      user: [actor, target],
      event: [makeEvent()],
      eventSegment: [{ id: 101, publicId: segmentPublicId(101), eventId: 100 }],
      eventSegmentUserResponse: [],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(db3Mutation, forgeDb3Insert(
      db3.xEventSegmentUserResponse.tableID, authorizationBandId,
      { bandUserId: "Member" + String(target.id).padStart(10, "0"), eventSegmentId: segmentPublicId(101), attendanceId: attendancePublicId(2) },
    ), ctx)).rejects.toThrow("Not authorized to mutate EventSegmentUserResponse")

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([])
  })

  it("does not substitute manage-events for change-others in generic updates", async () => {
    const permissions = [Permission.login, Permission.manage_events]
    const actor = createAuthorizationTestUser("normal", { id: 39, permissions })
    const target = createAuthorizationTestUser("normal", { id: 40 })
    resetAuthorizationDatabase({
      user: [actor, target],
      event: [makeEvent()],
      eventSegment: [{ id: 101, publicId: segmentPublicId(101), eventId: 100 }],
      eventSegmentUserResponse: [{
        id: 203, publicId: segmentResponsePublicId(203),
        bandUserId: target.id,
        eventSegmentId: 101,
        attendanceId: null,
      }],
      eventAttendance: [{ isActive: true, id: 2, publicId: attendancePublicId(2), isDeleted: false }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate(
      db3.xEventSegmentUserResponse.tableID, authorizationBandId,
      segmentResponsePublicId(203),
      { attendanceId: attendancePublicId(2) },
    ), ctx)).rejects.toThrow("Not authorized to mutate EventSegmentUserResponse")

    expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([
      expect.objectContaining({ id: 203, attendanceId: null }),
    ])
  })
})

describe("Band Admin split mutation boundaries", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthorizationDatabase({ change: [] })
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
    const visibilityId = authorizationPermissionId(Permission.visibility_public)
    const file = { bandId: 1,
      id: 61,
      publicId: filePublicId(61),
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
    resetAuthorizationDatabase({ user: [actor], file: [file], change: [] })
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: actor.id, permissions })

    await invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("File", authorizationBandId, file.publicId, { fileLeafName: "corrected-name.pdf" }),
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
      ["uploadedByUserId", actor.publicId],
    ] as const) {
      await expect(invokeResolver(
        db3Mutation,
        forgeDb3PublicUpdate("File", authorizationBandId, file.publicId, { [field]: value }),
        ctx,
      )).rejects.toThrow("Not authorized to mutate File fields")
    }
  })

  it("requires manage_user_taxonomy for tag definitions independently of manage_users", async () => {
    const profilePermissions = [Permission.login, Permission.manage_users]
    const profileManager = createAuthorizationTestUser("moderator", { id: 62, permissions: profilePermissions })
    const taxonomyPermissions = [...profilePermissions, Permission.manage_user_taxonomy]
    const taxonomyManager = createAuthorizationTestUser("bandAdmin", { id: 63, permissions: taxonomyPermissions })
    const tag = {
      id: 64,
      publicId: "UserTagPublic064",
      text: "Brass",
      description: "",
      sortOrder: 0,
      color: null,
      significance: null,
    }
    resetAuthorizationDatabase({ user: [profileManager, taxonomyManager],
      bandUserTag: [{ ...tag, bandId: 1, isHidden: false, globalUserTagId: null }], change: [] })

    const { ctx: profileCtx } = createAuthorizationPersona("moderator", {
      id: profileManager.id,
      permissions: profilePermissions,
    })
    await expect(invokeResolver(
      executeDB3CommandMutation,
      { bandPublicId: authorizationBandId, commandID: bandUserTagView.crud.operations.update.command.commandID,
        payload: { identity: tag.publicId, patch: { name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Winds" } } } },
      profileCtx,
    )).rejects.toThrow("Not authorized to mutate bandUserTag fields")

    const { ctx: taxonomyCtx } = createAuthorizationPersona("bandAdmin", {
      id: taxonomyManager.id,
      permissions: taxonomyPermissions,
    })
    await invokeResolver(
      executeDB3CommandMutation,
      { bandPublicId: authorizationBandId, commandID: bandUserTagView.crud.operations.update.command.commandID,
        payload: { identity: tag.publicId, patch: { name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Winds" } } } },
      taxonomyCtx,
    )
    expect(authorizationTestDb.snapshot("bandDynamicLocalizedStringValue")).toContainEqual(expect.objectContaining({ indexedValue: "Winds" }))
  })

  it("uses admin_instruments as the sole instrument-management capability", async () => {
    const ordinaryPermissions = [Permission.login, Permission.manage_users]
    const ordinaryManager = createAuthorizationTestUser("moderator", { id: 65, permissions: ordinaryPermissions })
    const instrumentPermissions = [...ordinaryPermissions, Permission.admin_instruments]
    const instrumentAdmin = createAuthorizationTestUser("bandAdmin", { id: 66, permissions: instrumentPermissions })
    const instrument = {
      id: 67,
      publicId: "instrmnt00000067",
      nameId: null,
      descriptionId: null,
      autoAssignFileLeafRegex: "tpt",
      sortOrder: 0,
      functionalGroupId: 1,
    }
    resetAuthorizationDatabase({ user: [ordinaryManager, instrumentAdmin],
      bandInstrument: [{ ...instrument, bandId: 1, isHidden: false, globalInstrumentId: null }],
      bandInstrumentFunctionalGroup: [{ id: 1, publicId: "InstrumentGroup1", bandId: 1, isHidden: false,
        globalFunctionalGroupId: null, nameId: null, descriptionId: null }], change: [] })

    const { ctx: ordinaryCtx } = createAuthorizationPersona("moderator", {
      id: ordinaryManager.id,
      permissions: ordinaryPermissions,
    })
    await expect(invokeResolver(
      executeDB3CommandMutation,
      { bandPublicId: authorizationBandId, commandID: bandInstrumentView.crud.operations.update.command.commandID,
        payload: { identity: instrument.publicId, patch: { name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Cornet" } } } },
      ordinaryCtx,
    )).rejects.toThrow("Not authorized to mutate bandInstrument fields")
    expect(authorizationTestDb.snapshot("change")).toEqual([])
    expect(authorizationTestDb.snapshot("bandInstrument")[0]?.nameId).toBeNull()

    const { ctx: adminCtx } = createAuthorizationPersona("bandAdmin", {
      id: instrumentAdmin.id,
      permissions: instrumentPermissions,
    })
    await invokeResolver(
      executeDB3CommandMutation,
      { bandPublicId: authorizationBandId, commandID: bandInstrumentView.crud.operations.update.command.commandID,
        payload: { identity: instrument.publicId, patch: { name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "Cornet" } } } },
      adminCtx,
    )
    expect(authorizationTestDb.snapshot("bandDynamicLocalizedStringValue")).toContainEqual(expect.objectContaining({ indexedValue: "Cornet" }))
  })
})
