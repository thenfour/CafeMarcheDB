import { wikiPageTagReferenceFixture, eventTagDtoFixture } from "./support/catalogReferenceFixtures";
import { eventStatusDtoFixture, eventTypeDtoFixture } from "./support/eventCatalogFixtures";
import type { LocalizedFieldValue } from "src/core/db3/shared/columnTypes/localizedString";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { testServerAuthorization } from "tests/support/serverAuthorization";
import type { EventAttendancePublicId, EventSegmentPublicId, EventSegmentUserResponsePublicId, EventUserResponsePublicId } from "shared/publicId";
import { Prisma } from "db"
import { z } from "zod"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import type { ColorPaletteEntry } from "src/core/components/color/palette"
import * as db3 from "src/core/db3/db3"
import {
  parsePublicId,
  type EventStatusPublicId,
  type EventTagAssignmentPublicId,
  type EventTagPublicId,
  type FileTagAssignmentPublicId,
  type FilePublicId,
  type FileTagPublicId,
  type FileEventTagPublicId,
  type FileInstrumentTagPublicId,
  type FileSongTagPublicId,
  type FileUserTagPublicId,
  type FileWikiPageTagPublicId,
  type InstrumentPublicId,
  type InstrumentFunctionalGroupPublicId,
  type SongCreditPublicId,
  type SongCreditTypePublicId,
  type SongTagPublicId,
  type SongPublicId,
  type BandUserPublicId,
  type UserTagPublicId,
  type UserPublicId,
  type WikiPageTagAssignmentPublicId,
  type WikiPageTagPublicId,
} from "shared/publicId"
import type { InheritedFieldValue } from "src/core/db3/shared/columnTypes/inherited"
import { compileDB3Selection } from "src/core/db3/shared/core/db3ViewContract"
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet"

const eventTypePublicId = parsePublicId<"EventType">("AbCdEfGhIjKlMn11")
const eventStatusPublicId = parsePublicId<"EventStatus">("AbCdEfGhIjKlMn12")
const permissionPublicId = parsePublicId<"Permission">("AbCdEfGhIjKlMn10")
const eventTagPublicId = parsePublicId<"EventTag">("AbCdEfGhIjKlMn13")
const eventTagAssignmentPublicId = parsePublicId<"EventTagAssignment">("AbCdEfGhIjKlMn14")
const userTagPublicId = parsePublicId<"UserTag">("AbCdEfGhIjKlMn15")
const songCreditTypePublicId = parsePublicId<"SongCreditType">("AbCdEfGhIjKlMn16")
const songCreditPublicId = parsePublicId<"SongCredit">("AbCdEfGhIjKlMn17")
const userTagAssignmentPublicId = parsePublicId<"UserTagAssignment">("AbCdEfGhIjKlMn16")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DB3 scalar selection compiler", () => {
  it("makes unsupported tag relation declarations compile-time errors", () => {
    const args = {
      associationForeignIDMember: "bandEventTagId",
      associationForeignObjectMember: "eventTag",
      associationLocalObjectMember: "event",
      authMap: db3.xEventAuthMap_Homepage,
      getQuickFilterWhereClause: () => false,
      getCustomFilterWhereClause: () => false,
    } as const

    const factory = db3.tagsRef("EventTagAssignment", "BandEventTag", args)
    expect(factory("tags").foreignTableID).toBe("BandEventTag")

    if (false) {
      // @ts-expect-error The foreign table must be the target of eventTag.
      db3.tagsRef("EventTagAssignment", "UserTag", args)
      // @ts-expect-error Association IDs must be registered Prisma model IDs.
      db3.tagsRef("eventTagAssignment", "EventTag", args)
      // @ts-expect-error Local members must be Prisma relations backed by `${member}Id`.
      db3.tagsRef("EventTagAssignment", "BandEventTag", { ...args, associationLocalObjectMember: "notARelation" })
      // @ts-expect-error TagsField construction is intentionally restricted to tagsRef().
      new db3.TagsField({} as never)
    }
  })

  it("derives the finite Event Search relation graph without recursive widening", () => {
    const selection = db3.eventSearchSelection({
      filter: { items: [] },
      auth: testServerAuthorization(null, new ServerPermissionSet([])),
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    type FullDto = z.infer<typeof derived.dtoSchema>
    type Segment = NonNullable<FullDto["segments"]>[number]
    type SegmentResponse = NonNullable<Segment["responses"]>[number]
    type EventResponse = NonNullable<FullDto["responses"]>[number]
    type TransportDto = db3.EventSearchDto
    type DescriptionWikiPage = NonNullable<TransportDto["descriptionWikiPage"]>
    type CurrentRevision = NonNullable<DescriptionWikiPage["currentRevision"]>
    type RootAuthorizationOnlyKeys = Extract<
      keyof TransportDto,
      "createdByUserId" | "isDeleted"
    >
    type WikiAuthorizationOnlyKeys = Extract<
      keyof DescriptionWikiPage,
      "createdByUserId" | "visiblePermissionId"
    >
    type ContentIsAny = 0 extends (1 & CurrentRevision["content"]) ? true : false

    expectTypeOf<db3.DB3RelationTargetTableOf<typeof db3.xEvent.fields.segments>>()
      .toEqualTypeOf<typeof db3.xEventSegment>()
    expectTypeOf<db3.DB3RelationTargetTableOf<typeof db3.xEvent.fields.tags>>()
      .toEqualTypeOf<typeof db3.xEventTagAssignment>()
    expectTypeOf<db3.DB3RelationTargetTableOf<typeof db3.xWikiPage.fields.currentRevision>>()
      .toEqualTypeOf<typeof db3.xWikiPageCurrentRevision>()
    expectTypeOf<db3.DB3RelationTargetTableOf<typeof db3.xWikiPage.fields.revisions>>()
      .toEqualTypeOf<typeof db3.xWikiPageRevision>()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationTableID>()
      .toEqualTypeOf<"EventTagAssignment">()
    expectTypeOf<typeof db3.xEvent.fields.tags.foreignTableID>()
      .toEqualTypeOf<"BandEventTag">()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationLocalIDMember>()
      .toEqualTypeOf<"eventId">()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationForeignIDMember>()
      .toEqualTypeOf<"bandEventTagId">()
    expectTypeOf<Segment>().toEqualTypeOf<{
      publicId: EventSegmentPublicId
      name?: string
      startsAt?: Date | null
      durationMillis?: bigint
      isAllDay?: boolean
      statusId?: EventStatusPublicId | null
      responses?: Array<{
        publicId: EventSegmentUserResponsePublicId
        bandUserId?: BandUserPublicId
        attendanceId?: EventAttendancePublicId | null
      }>
    }>()
    expectTypeOf<SegmentResponse["publicId"]>().toEqualTypeOf<EventSegmentUserResponsePublicId>()
    expectTypeOf<EventResponse["publicId"]>().toEqualTypeOf<EventUserResponsePublicId>()
    expectTypeOf<TransportDto["name"]>().toEqualTypeOf<string>()
    expectTypeOf<TransportDto["tags"]>().toBeArray()
    expectTypeOf<ContentIsAny>().toEqualTypeOf<false>()
    expectTypeOf<CurrentRevision["content"]>().toEqualTypeOf<string>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<WikiAuthorizationOnlyKeys>().toEqualTypeOf<never>()
  })

  it("keeps the Event detail creator public", () => {
    expectTypeOf<Extract<keyof db3.EventDetailDto, "createdByUserId">>()
      .toEqualTypeOf<never>()
    expectTypeOf<NonNullable<db3.EventDetailClient["createdByUser"]>["publicId"]>()
      .toEqualTypeOf<UserPublicId>()
  })

  it("derives the File Search transport and concrete consumer relations", () => {
    type TransportDto = db3.FileSearchDto
    type Client = db3.FileSearchClient
    type DtoTag = NonNullable<TransportDto["tags"]>[number]
    type DtoSongTag = NonNullable<TransportDto["taggedSongs"]>[number]
    type DtoEventTag = NonNullable<TransportDto["taggedEvents"]>[number]
    type DtoInstrumentTag = NonNullable<TransportDto["taggedInstruments"]>[number]
    type DtoWikiPageTag = NonNullable<TransportDto["taggedWikiPages"]>[number]
    type ClientTag = NonNullable<Client["tags"]>[number]
    type ClientSongTag = NonNullable<Client["taggedSongs"]>[number]
    type ClientEventTag = NonNullable<Client["taggedEvents"]>[number]
    type ClientInstrumentTag = NonNullable<Client["taggedInstruments"]>[number]
    type ClientWikiPageTag = NonNullable<Client["taggedWikiPages"]>[number]
    type DtoSong = NonNullable<NonNullable<TransportDto["taggedSongs"]>[number]["song"]>
    type RootAuthorizationOnlyKeys = Extract<
      keyof TransportDto,
      "uploadedByUserId" | "isDeleted"
    >
    type SongAuthorizationOnlyKeys = Extract<
      keyof DtoSong,
      "createdByUserId" | "visiblePermissionId" | "isDeleted"
    >
    type FileTagIsAny = 0 extends (1 & ClientTag["bandFileTag"]) ? true : false

    expectTypeOf<DtoTag["publicId"]>().toEqualTypeOf<FileTagAssignmentPublicId>()
    expectTypeOf<DtoTag["bandFileTagId"]>().toEqualTypeOf<FileTagPublicId>()
    expectTypeOf<Extract<keyof DtoTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<DtoSongTag["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<DtoEventTag["publicId"]>().toEqualTypeOf<FileEventTagPublicId>()
    expectTypeOf<DtoInstrumentTag["publicId"]>().toEqualTypeOf<FileInstrumentTagPublicId>()
    expectTypeOf<DtoInstrumentTag["bandInstrumentId"]>().toEqualTypeOf<InstrumentPublicId>()
    expectTypeOf<DtoWikiPageTag["publicId"]>().toEqualTypeOf<FileWikiPageTagPublicId>()
    expectTypeOf<Extract<keyof DtoSongTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoEventTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoInstrumentTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoWikiPageTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<ClientTag["bandFileTag"]>()
      .toEqualTypeOf<NonNullable<ClientTag["bandFileTag"]>>()
    expectTypeOf<ClientSongTag["song"]>()
      .toEqualTypeOf<NonNullable<ClientSongTag["song"]>>()
    expectTypeOf<ClientEventTag["event"]>()
      .toEqualTypeOf<NonNullable<ClientEventTag["event"]>>()
    expectTypeOf<ClientInstrumentTag["bandInstrument"]>()
      .toEqualTypeOf<NonNullable<ClientInstrumentTag["bandInstrument"]>>()
    expectTypeOf<ClientWikiPageTag["wikiPage"]>()
      .toEqualTypeOf<NonNullable<ClientWikiPageTag["wikiPage"]>>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<SongAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileTagIsAny>().toEqualTypeOf<false>()
  })

  it("derives transport DTOs from a fetched selection subset", () => {
    const prismaSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: {
        publicId: true,
        isDeleted: true,
      },
    })
    const transportSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: { publicId: true },
    })
    const derived = db3.deriveViewContract(db3.xSong, prismaSelection, {
      transportSelection,
    })

    expectTypeOf(derived.prismaSelection).toEqualTypeOf<typeof prismaSelection>()
    expectTypeOf<z.infer<typeof derived.dtoSchema>>().toEqualTypeOf<{ publicId: SongPublicId }>()
    expect(derived.dtoSchema.parse({ publicId: "Song000000000001", isDeleted: false })).toEqual({ publicId: "Song000000000001" })
  })

  it("rejects transport members absent from the Prisma selection", () => {
    const prismaSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: { id: true },
    })
    const transportSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: { id: true, name: true },
    })

    expect(() => db3.deriveViewContract(db3.xSong, prismaSelection, {
      transportSelection,
    })).toThrow(
      "'Song.select.name': transport selection member is not fetched by the Prisma selection",
    )
  })

  it("preserves the Prisma selection and derives required nullable scalar schemas", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        publicId: true,
        significance: true,
        iconName: true,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf(compiled.prismaSelection).toEqualTypeOf<typeof selection>()
    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      significance: string | null
      iconName: string | null
    }>()

    expect(compiled.prismaSelection).toBe(selection)
    expect(compiled.members.map(member => ({
      member: member.member,
      required: member.required,
    }))).toEqual([
      { member: "publicId", required: true },
      { member: "significance", required: true },
      { member: "iconName", required: true },
    ])
    expect(compiled.dtoSchema.parse({
      publicId: eventStatusPublicId,
      significance: "FinalConfirmation",
      iconName: null,
    })).toEqual({
      publicId: eventStatusPublicId,
      significance: "FinalConfirmation",
      iconName: null,
    })
    expect(compiled.dtoSchema.safeParse({ id: 10, iconName: null }).success).toBe(false)
    expect(compiled.dtoSchema.safeParse({
      id: 10,
      significance: "FinalConfirmation",
      iconName: undefined,
    }).success).toBe(false)
  })

  it("adds Zod optionality for independently authorized fields", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        isDeleted: true,
        relevanceClassOverride: true,
      },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      isDeleted?: boolean
      relevanceClassOverride?: number | null
    }>()

    expect(compiled.members.every(member => member.required === false)).toBe(true)
    expect(compiled.dtoSchema.parse({})).toEqual({})
    expect(compiled.dtoSchema.parse({ isDeleted: false }))
      .toEqual({ isDeleted: false })
  })

  it("ignores Prisma members explicitly excluded with false", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        publicId: true,
        significance: false,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
    }>()

    expect(compiled.members.map(member => member.member)).toEqual(["publicId"])
    expect(compiled.dtoSchema.parse({ publicId: eventStatusPublicId, significance: "stripped" })).toEqual({ publicId: eventStatusPublicId })
  })

  it("reports the entity and complete path for unknown selected members", () => {
    expect(() => compileDB3Selection(db3.xEventStatus, {
      select: { unknownMember: true },
    } as any)).toThrow(
      "DB3 table 'EventStatus' cannot compile selection path "
      + "'EventStatus.select.unknownMember'",
    )
  })

  it("rejects fields without scalar read contracts", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: { events: true },
    })

    expect(() => compileDB3Selection(db3.xEventStatus, selection)).toThrow(
      "'EventStatus.select.events': GhostField field 'events' does not declare "
      + "a read transport schema for its field member 'events'",
    )
  })

  it("allows an explicitly typed primitive ghost member", () => {
    const selection = Prisma.validator<Prisma.BandUserTagDefaultArgs>()({
      select: {
        bandUserTagAssignments: {
          select: { bandUserId: true },
        },
      },
    })

    const compiled = compileDB3Selection(db3.xBandUserTag, selection)
    type Dto = z.infer<typeof compiled.dtoSchema>

    expectTypeOf<Dto["bandUserTagAssignments"]>().toEqualTypeOf<{
      bandUserId: BandUserPublicId
    }[] | undefined>()
    expect(compiled.dtoSchema.parse({ bandUserTagAssignments: [{ bandUserId: parsePublicId<"BandUser">("TestUser00000012") }] }))
      .toEqual({ bandUserTagAssignments: [{ bandUserId: parsePublicId<"BandUser">("TestUser00000012") }] })
    expect(compiled.dtoSchema.safeParse({
      bandUserTagAssignments: [{ bandUserId: "12" }],
    }).success).toBe(false)
    expect(compiled.dtoSchema.safeParse({
      bandUserTagAssignments: [{ bandUserId: null }],
    }).success).toBe(false)
  })

  it("derives a selected Prisma count as a validated structured value", () => {
    const selection = Prisma.validator<Prisma.CustomLinkDefaultArgs>()({
      select: { _count: { select: { visits: true } } },
    })

    const compiled = compileDB3Selection(db3.xCustomLink, selection)
    type Dto = z.infer<typeof compiled.dtoSchema>

    expectTypeOf<Dto>().toEqualTypeOf<{ _count: { visits: number } }>()
    expect(compiled.members[0]).toMatchObject({ kind: "value", ownershipKind: "field" })
    expect(compiled.dtoSchema.parse({ _count: { visits: 3 } }))
      .toEqual({ _count: { visits: 3 } })
    expect(compiled.dtoSchema.safeParse({ _count: { visits: -1 } }).success).toBe(false)
    expect(compiled.dtoSchema.safeParse({ _count: { visits: "3" } }).success).toBe(false)

    // A malformed runtime selection can bypass Prisma's compile-time key check.
    const unknownCountSelection = {
      select: { _count: { select: { missing: true } } },
    } as unknown as Prisma.CustomLinkDefaultArgs
    expect(() => compileDB3Selection(db3.xCustomLink, unknownCountSelection))
      .toThrow("CustomLink.select._count.select.missing")
  })

  it("derives normalized foreign-key transport schemas", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      statusId?: EventStatusPublicId | null
    }>()

    expect(compiled.members[0]).toMatchObject({
      kind: "value",
      ownershipKind: "foreignKey",
      member: "statusId",
    })
    expect(compiled.dtoSchema.parse({ statusId: null })).toEqual({ statusId: null })
    expect(compiled.dtoSchema.parse({ statusId: eventStatusPublicId })).toEqual({ statusId: eventStatusPublicId })
    expect(compiled.dtoSchema.safeParse({ statusId: 12 }).success).toBe(false)
  })

  it("fetches projection-only public identities without widening the transport DTO", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })

    const derived = db3.deriveViewContract(db3.xEvent, selection)
    type Dto = z.infer<typeof derived.dtoSchema>

    expectTypeOf<Dto>().toEqualTypeOf<{
      statusId?: EventStatusPublicId | null
    }>()
    expect(derived.prismaSelection).toEqual({
      select: {
        statusId: true,
        status: { select: { publicId: true, isDeleted: true } },
        bandId: true,
        createdByUserId: true,
        visiblePermissionId: true,
        isDeleted: true,
      },
    })
    expect(derived.dtoSchema.parse({
      statusId: eventStatusPublicId,
      status: { publicId: eventStatusPublicId },
    })).toEqual({ statusId: eventStatusPublicId })
  })

  it("recursively compiles nested foreign-single selections", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: { publicId: true, significance: true },
        },
      },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      status?: {
        publicId: EventStatusPublicId
        significance: string | null
      } | null
    }>()

    expect(compiled.members[0]).toMatchObject({
      kind: "relation",
      ownershipKind: "foreignObject",
      cardinality: "one",
      member: "status",
    })
    expect(compiled.dtoSchema.parse({ status: null })).toEqual({ status: null })
    expect(compiled.dtoSchema.parse({ status: { publicId: eventStatusPublicId, significance: "FinalConfirmation" } }))
      .toEqual({ status: { publicId: eventStatusPublicId, significance: "FinalConfirmation" } })
    expect(compiled.dtoSchema.safeParse({
      status: { publicId: 4, significance: "FinalConfirmation" },
    }).success).toBe(false)
  })

  it("rejects include-only selections explicitly", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      include: { status: true },
    })

    expect(() => compileDB3Selection(db3.xEvent, selection)).toThrow(
      "'Event.include': selection derivation currently supports explicit 'select' shapes only",
    )
  })

  it("preserves shape-neutral nested relation arguments like orderBy and where", () => {
    const args: Prisma.EventDefaultArgs = {
      select: {
        locationURL: true,
        tags: {
          select: {
            publicId: true,
            bandEventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                isHidden: true,
              },
            },
          },
          orderBy: {
            bandEventTagId: "asc"
          },
          where: {
            bandEventTagId: { gt: 0 },
          },
        },
      },
    }

    const validated = Prisma.validator<Prisma.EventDefaultArgs>()(args)
    const compiled = compileDB3Selection(db3.xEvent, validated)
    const dto = {
      locationURL: "https://example.com",
      tags: [{
        publicId: eventTagAssignmentPublicId,
        bandEventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          isHidden: false,
        },
      }],
    }

    expect(compiled.prismaSelection).toBe(validated)
    expect(compiled.prismaSelection.select?.tags).toMatchObject({
      orderBy: { bandEventTagId: "asc" },
      where: { bandEventTagId: { gt: 0 } },
    })
    expect(compiled.members).toHaveLength(2)
    expect(compiled.members[1]).toMatchObject({
      kind: "relation",
      ownershipKind: "relationCollection",
      cardinality: "many",
      member: "tags",
    })
    expect(compiled.dtoSchema.parse(dto)).toEqual(dto)
    expect(compiled.dtoSchema.safeParse({
      ...dto,
      tags: [{ ...dto.tags[0], bandEventTagId: 12 }],
    }).success).toBe(false)
  })

  it("derives the selected nested DTO type without widening Prisma arguments", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        locationURL: true,
        tags: {
          select: {
            publicId: true,
            bandEventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                isHidden: true,
              },
            },
          },
          orderBy: { bandEventTagId: "asc" },
          where: { bandEventTagId: { gt: 0 } },
        },
      },
    })

    const schema = db3.deriveDtoSchema(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<{
      locationURL: string
      tags: Array<{
        publicId: EventTagAssignmentPublicId
        bandEventTagId: EventTagPublicId
        eventTag: {
          publicId: EventTagPublicId
          isHidden: boolean
        }
      }>
    }>()
    expect(schema.parse({
      locationURL: "https://example.com",
      tags: [{
        publicId: eventTagAssignmentPublicId,
        bandEventTagId: eventTagPublicId,
        eventTag: { publicId: eventTagPublicId, isHidden: false },
      }],
    })).toEqual({
      locationURL: "https://example.com",
      tags: [{
        publicId: eventTagAssignmentPublicId,
        bandEventTagId: eventTagPublicId,
        eventTag: { publicId: eventTagPublicId, isHidden: false },
      }],
    })
  })
})

describe("DB3 derived scalar hydration", () => {
  it("derives distinct DTO and consumer types and decodes each present scalar once", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        publicId: true,
        significance: true,
        color: true,
      },
    })
    const derived = db3.deriveViewContract(db3.xEventStatus, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")
    const dto = {
      publicId: eventStatusPublicId,
      significance: "FinalConfirmation",
      color: "green",
    }

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      significance: string | null
      color: string | null
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      significance: string | null
      color: ColorPaletteEntry | null
    }>()

    const hydrated = derived.hydrate(dto, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      publicId: eventStatusPublicId,
      significance: "FinalConfirmation",
      color: expect.objectContaining({ id: "green" }),
    })
    expect(dto.color).toBe("green")
    expect(decode).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledWith("green")
  })

  it("passes nullable transport values through the codec exactly once", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: { color: true },
    })
    const derived = db3.deriveViewContract(db3.xEventStatus, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")

    expect(derived.hydrate({ color: null }, new db3.DB3ReferenceStore()))
      .toEqual({ color: null })
    expect(decode).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledWith(null)
  })

  it("preserves authorization absence without invoking the field codec", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { isDeleted: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const decode = vi.spyOn(db3.xEvent.fields.isDeleted.codec, "decode")
    const references = new db3.DB3ReferenceStore()

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      isDeleted?: boolean
    }>()
    expect(derived.hydrate({}, references)).toEqual({})
    expect(decode).not.toHaveBeenCalled()

    expect(derived.hydrate({ isDeleted: false }, references))
      .toEqual({ isDeleted: false })
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it("validates the complete DTO before invoking any codec", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        color: true,
        sortOrder: true,
      },
    })
    const derived = db3.deriveViewContract(db3.xEventStatus, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")

    expect(() => derived.hydrate({
      color: "green",
      sortOrder: 1.5,
    }, new db3.DB3ReferenceStore())).toThrow()
    expect(decode).not.toHaveBeenCalled()
  })
})

describe("localized EventStatus editor", () => {
  const dto = eventStatusDtoFixture(eventStatusPublicId)
  it("retains view identity and fetches field-owned translation dependencies", () => {
    expect(db3.eventStatusEditorView.viewID).toBe("EventStatus_Editor")
    expect(db3.eventStatusEditorView.getSelectionArgs({ filter: { items: [] }, auth: testServerAuthorization(null, new ServerPermissionSet([])) }))
      .toMatchObject({ select: { ...db3.eventStatusEditorSelection.select, nameId: true, descriptionId: true } }) // Localized fields add their storage identities as read dependencies.
    expect(db3.eventStatusEditorSelection.select).toMatchObject({ name: true, description: true })
  })
  it("requires complete resolved fields and retains nullable text and resolution metadata", () => {
    expect(db3.eventStatusEditorView.dtoSchema.safeParse({ publicId: eventStatusPublicId }).success).toBe(false)
    expect(db3.eventStatusEditorView.dtoSchema.safeParse(dto).success).toBe(true)
    expectTypeOf<db3.DtoOf<typeof db3.eventStatusEditorView>["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<db3.ClientOf<typeof db3.eventStatusEditorView>["name"]>().toEqualTypeOf<LocalizedFieldValue>()
  })
  it("hydrates localized editor state and palette values through authoritative fields", () => {
    const client = db3.eventStatusEditorView.hydrate(dto, new db3.DB3ReferenceStore())
    expect(client).toEqual(db3.xEventStatus.getClientModel(dto, "view"))
    expect(client.name).toMatchObject({ value: "Confirmed", stringPublicId: null, canInherit: false })
    expect(client.color).toMatchObject({ id: "green" })
  })
})

describe("Event lookup editor derived-view rollout", () => {
  it("migrates EventType with localized editor state and palette hydration", () => {
    const dto = eventTypeDtoFixture(eventTypePublicId)
    expectTypeOf<db3.DtoOf<typeof db3.eventTypeEditorView>["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<db3.ClientOf<typeof db3.eventTypeEditorView>["color"]>().toEqualTypeOf<ColorPaletteEntry | null>()
    expect(db3.eventTypeEditorView.hydrate(dto, new db3.DB3ReferenceStore()))
      .toEqual(db3.xEventType.getClientModel(dto, "view"))
  })

  it("migrates band event tags with localized and inherited codecs", () => {
    type Dto = db3.DtoOf<typeof db3.bandEventTagView>
    type Client = db3.ClientOf<typeof db3.bandEventTagView>
    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<EventTagPublicId>()
    expectTypeOf<Dto["visibleOnFrontpage"]>().toEqualTypeOf<boolean>()
    expectTypeOf<Client["name"]>().toEqualTypeOf<LocalizedFieldValue>()
    const dto = eventTagDtoFixture(eventTagPublicId)
    expect(db3.bandEventTagView.hydrate(dto, new db3.DB3ReferenceStore()))
      .toEqual(db3.xBandEventTag.getClientModel(dto, "view"))
  })
})

describe("band invitation tag derived-view migration", () => {
  it("uses membership identities independently of shared person identities", () => {
    type Dto = db3.DtoOf<typeof db3.userTagEventSearchView>
    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<Dto["bandUserTagAssignments"]>().toEqualTypeOf<{
      bandUserId: BandUserPublicId
    }[] | undefined>()
    expect(db3.userTagEventSearchView.entity).toBe(db3.xBandUserTag)
    const dto: Dto = { publicId: userTagPublicId,
      bandUserTagAssignments: [{ bandUserId: parsePublicId<"BandUser">("TestMember000042") }] }
    expect(db3.userTagEventSearchView.hydrate(dto, new db3.DB3ReferenceStore())).toEqual(dto)
    expect(Object.values(db3.gAllTables).some(table => table.tableID === "UserTag" || table.tableID === "UserTagAssignment"))
      .toBe(false)
  })
})

describe("Wiki page tag derived-view migration", () => {
  const tagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001")
  const assignmentPublicId = parsePublicId<"WikiPageTagAssignment">("WikiTagAssign001")

  it("uses public identities in tag administration and page association DTOs", () => {
    type TagDto = db3.DtoOf<typeof db3.bandWikiPageTagView>
    type EditorDto = db3.WikiPageEditorDto
    type SearchDto = db3.WikiPageSearchDto
    type EditorAssignment = NonNullable<EditorDto["tags"]>[number]
    type SearchAssignment = NonNullable<SearchDto["tags"]>[number]

    expectTypeOf<TagDto["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<db3.ClientOf<typeof db3.bandWikiPageTagView>["name"]>().toEqualTypeOf<LocalizedFieldValue>()
    expectTypeOf<TagDto["publicId"]>().toEqualTypeOf<WikiPageTagPublicId>()
    expectTypeOf<Extract<keyof TagDto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<EditorAssignment["publicId"]>()
      .toEqualTypeOf<WikiPageTagAssignmentPublicId>()
    expectTypeOf<NonNullable<EditorAssignment["bandWikiPageTagId"]>>()
      .toEqualTypeOf<WikiPageTagPublicId>()
    expectTypeOf<Extract<keyof EditorAssignment, "id" | "tag">>()
      .toEqualTypeOf<never>()
    expectTypeOf<SearchAssignment>().toEqualTypeOf<EditorAssignment>()
  })

  it("hydrates page-tag associations from the dashboard reference contract", () => {
    const references = db3.createDashboardReferenceStore()
    const tag = wikiPageTagReferenceFixture(tagPublicId)
    db3.registerDashboardReferences(references, { wikiPageTag: [tag] })

    const dto = db3.wikiPageEditorView.parseDto({
      publicId: parsePublicId<"WikiPage">("AbCdEfGhIjKlMn99"),
      tags: [{ publicId: assignmentPublicId, bandWikiPageTagId: tagPublicId }],
    })
    const hydrated = db3.hydrateView(db3.wikiPageEditorView, dto, references)

    expect(dto).not.toHaveProperty("id")
    expect(hydrated.tags).toEqual([{
      publicId: assignmentPublicId,
      bandWikiPageTagId: tagPublicId,
      tag,
    }])
  })
})

describe("File derived-view migration", () => {
  it("derives File Tag transport and consumer codecs", () => {
    type Dto = db3.DtoOf<typeof db3.bandFileTagView>
    type Client = db3.ClientOf<typeof db3.bandFileTagView>

    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<FileTagPublicId>()
    expectTypeOf<Extract<keyof Dto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Dto["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<Client["name"]>().toEqualTypeOf<LocalizedFieldValue>()
    expectTypeOf<Dto["color"]>()
      .toEqualTypeOf<string | null>()
    expectTypeOf<Client["color"]>()
      .toEqualTypeOf<InheritedFieldValue<ColorPaletteEntry | null>>()
    expect(db3.bandFileTagView.getSelectionArgs(
      // This catalog's static selection does not inspect the request context.
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.bandFileTagContract.prismaSelection)
  })

  it("derives finite File Detail DTO relations and normalized client associations", () => {
    type Dto = db3.FileDetailDto
    type Client = db3.FileDetailClient
    type RelatedFileDto = NonNullable<Dto["childFiles"]>[number]
    type PinnedSongDto = NonNullable<Dto["pinnedForSongs"]>[number]
    type ClientFileTag = NonNullable<Client["tags"]>[number]
    type ClientUserTag = NonNullable<Client["taggedUsers"]>[number]
    type ClientSongTag = NonNullable<Client["taggedSongs"]>[number]
    type ClientEventTag = NonNullable<Client["taggedEvents"]>[number]
    type ClientInstrumentTag = NonNullable<Client["taggedInstruments"]>[number]
    type ClientWikiPageTag = NonNullable<Client["taggedWikiPages"]>[number]
    type DtoUserTag = NonNullable<Dto["taggedUsers"]>[number]
    type DtoSongTag = NonNullable<Dto["taggedSongs"]>[number]
    type DtoEventTag = NonNullable<Dto["taggedEvents"]>[number]
    type DtoInstrumentTag = NonNullable<Dto["taggedInstruments"]>[number]
    type DtoWikiPageTag = NonNullable<Dto["taggedWikiPages"]>[number]
    type RootAuthorizationOnlyKeys = Extract<keyof Dto, "isDeleted">
    type RelatedAuthorizationOnlyKeys = Extract<
      keyof RelatedFileDto,
      "uploadedByUserId" | "visiblePermissionId" | "isDeleted"
    >
    type PinnedAuthorizationOnlyKeys = Extract<
      keyof PinnedSongDto,
      "createdByUserId" | "visiblePermissionId" | "isDeleted"
    >

    expectTypeOf<Dto["customData"]>()
      .toEqualTypeOf<string | null | undefined>()
    expectTypeOf<RelatedFileDto>().toEqualTypeOf<{
      publicId: FilePublicId
      fileLeafName?: string
    }>()
    expectTypeOf<PinnedSongDto>().toEqualTypeOf<{
      publicId: SongPublicId
      name: string
    }>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<RelatedAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<PinnedAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<DtoUserTag["publicId"]>().toEqualTypeOf<FileUserTagPublicId>()
    expectTypeOf<DtoUserTag["bandUser"]["user"]["publicId"]>().toEqualTypeOf<UserPublicId>()
    expectTypeOf<DtoSongTag["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<DtoEventTag["publicId"]>().toEqualTypeOf<FileEventTagPublicId>()
    expectTypeOf<DtoInstrumentTag["publicId"]>().toEqualTypeOf<FileInstrumentTagPublicId>()
    expectTypeOf<DtoWikiPageTag["publicId"]>().toEqualTypeOf<FileWikiPageTagPublicId>()
    expectTypeOf<Extract<keyof DtoUserTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoSongTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoEventTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoInstrumentTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoWikiPageTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["bandFileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["bandFileTag"]>>()
    expectTypeOf<ClientUserTag["bandUser"]>()
      .toEqualTypeOf<NonNullable<ClientUserTag["bandUser"]>>()
    expectTypeOf<ClientSongTag["song"]>()
      .toEqualTypeOf<NonNullable<ClientSongTag["song"]>>()
    expectTypeOf<ClientEventTag["event"]>()
      .toEqualTypeOf<NonNullable<ClientEventTag["event"]>>()
    expectTypeOf<ClientInstrumentTag["bandInstrument"]>()
      .toEqualTypeOf<NonNullable<ClientInstrumentTag["bandInstrument"]>>()
    expectTypeOf<ClientWikiPageTag["wikiPage"]>()
      .toEqualTypeOf<NonNullable<ClientWikiPageTag["wikiPage"]>>()
    expect(db3.fileDetailView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.fileDetailSelection)
  })

  it("derives the File Editor subset without widening its transport", () => {
    type Dto = db3.DtoOf<typeof db3.fileEditorView>
    type Client = db3.ClientOf<typeof db3.fileEditorView>
    type ClientFileTag = NonNullable<Client["tags"]>[number]
    type DetailOnlyKeys = Extract<
      keyof Dto,
      "frontpageGalleryItems" | "parentFile" | "childFiles" | "pinnedForSongs"
    >

    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<FilePublicId>()
    expectTypeOf<Dto["isDeleted"]>()
      .toEqualTypeOf<boolean>()
    expectTypeOf<Dto["customData"]>()
      .toEqualTypeOf<string | null | undefined>()
    expectTypeOf<DetailOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["bandFileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["bandFileTag"]>>()
    expect(db3.fileEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.fileEditorSelection)
  })
})

describe("Song derived-view migration", () => {
  it("projects the nullable pinned File reference to public identity", () => {
    const selection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: { pinnedRecordingId: true },
    })
    const derived = db3.deriveViewContract(db3.xSong, selection)
    type Dto = z.infer<typeof derived.dtoSchema>

    expectTypeOf<Dto>().toEqualTypeOf<{
      pinnedRecordingId: FilePublicId | null
    }>()
    expect(derived.dtoSchema.parse({ pinnedRecordingId: null }))
      .toEqual({ pinnedRecordingId: null })
    const fileId = parsePublicId<"File">("File000000000012")
    expect(derived.dtoSchema.parse({ pinnedRecordingId: fileId }))
      .toEqual({ pinnedRecordingId: fileId })
    expect(derived.dtoSchema.safeParse({ pinnedRecordingId: 12 }).success)
      .toBe(false)
  })

  it("derives the Song metadata and credit editor contracts", () => {
    type TagDto = db3.DtoOf<typeof db3.songTagEditorView>
    type TagClient = db3.ClientOf<typeof db3.songTagEditorView>
    type CreditTypeDto = db3.DtoOf<typeof db3.songCreditTypeEditorView>
    type CreditTypeClient = db3.ClientOf<typeof db3.songCreditTypeEditorView>
    type CreditDto = db3.DtoOf<typeof db3.songCreditEditorView>
    type CreditClient = db3.ClientOf<typeof db3.songCreditEditorView>
    type NestedCreditTypeClient = NonNullable<CreditClient["type"]>

    expectTypeOf<TagDto["publicId"]>().toEqualTypeOf<SongTagPublicId>()
    expectTypeOf<TagDto["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<TagDto["color"]>().toEqualTypeOf<string | null>()
    expectTypeOf<TagClient["color"]>()
      .toEqualTypeOf<InheritedFieldValue<ColorPaletteEntry | null>>()
    expectTypeOf<CreditTypeDto["name"]>().toEqualTypeOf<string | null>()
    expectTypeOf<CreditTypeClient["name"]>().toEqualTypeOf<LocalizedFieldValue>()
    expectTypeOf<NestedCreditTypeClient["name"]>().toEqualTypeOf<string>()
    expectTypeOf<Extract<keyof CreditDto, "type">>().toEqualTypeOf<never>()
    expectTypeOf<CreditTypeDto["color"]>()
      .toEqualTypeOf<string | null>()
    expectTypeOf<CreditTypeDto["publicId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<CreditTypeClient["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expectTypeOf<CreditDto["publicId"]>()
      .toEqualTypeOf<SongCreditPublicId>()
    expectTypeOf<CreditDto["typeId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<CreditDto["userId"]>()
      .toEqualTypeOf<UserPublicId | null>()
    expectTypeOf<CreditDto["songId"]>().toEqualTypeOf<SongPublicId>()
    expectTypeOf<NestedCreditTypeClient["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expectTypeOf<Extract<keyof CreditTypeDto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof CreditDto, "id">>().toEqualTypeOf<never>()
    expect(db3.xSongCreditType.getIdentity({ publicId: songCreditTypePublicId }))
      .toBe(songCreditTypePublicId)
    expect(db3.xSongCredit.getIdentity({ publicId: songCreditPublicId }))
      .toBe(songCreditPublicId)

    expect(db3.songTagEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toMatchObject(db3.songTagEditorSelection)
    expect(db3.songCreditTypeEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toMatchObject(db3.songCreditTypeEditorSelection)
    expect(db3.songCreditEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toMatchObject(db3.songCreditEditorSelection)
  })

  it("derives Song Editor nested transport and consumer codecs", () => {
    type Dto = db3.DtoOf<typeof db3.songEditorView>
    type Client = db3.ClientOf<typeof db3.songEditorView>
    type PermissionDto = NonNullable<Dto["visiblePermission"]>
    type PermissionClient = NonNullable<Client["visiblePermission"]>
    type TagDto = NonNullable<NonNullable<Dto["tags"]>[number]["tag"]>
    type TagClient = NonNullable<NonNullable<Client["tags"]>[number]["tag"]>

    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<SongPublicId>()
    expectTypeOf<Dto["name"]>().toEqualTypeOf<string>()
    expectTypeOf<Dto["visiblePermissionId"]>()
      .toEqualTypeOf<typeof permissionPublicId | null>()
    expectTypeOf<PermissionDto["name"]>().toEqualTypeOf<string>()
    expectTypeOf<PermissionDto["color"]>().toEqualTypeOf<string | null>()
    expectTypeOf<PermissionClient["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expectTypeOf<TagDto["color"]>()
      .toEqualTypeOf<string | null>()
    expectTypeOf<TagClient["color"]>()
      .toEqualTypeOf<InheritedFieldValue<ColorPaletteEntry | null>>()
    expect(db3.songEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toMatchObject(db3.songEditorSelection)
  })

  it("derives Song Search without leaking authorization support fields", () => {
    type Dto = db3.SongSearchDto
    type Client = db3.SongSearchClient
    type DtoTag = NonNullable<Dto["tags"]>[number]
    type ClientTag = NonNullable<Client["tags"]>[number]
    type DtoFileAssociation = NonNullable<Dto["taggedFiles"]>[number]
    type ClientFile = NonNullable<
      NonNullable<Client["taggedFiles"]>[number]["file"]
    >
    type ClientFileTag = NonNullable<ClientFile["tags"]>[number]
    type DtoCredit = NonNullable<Dto["credits"]>[number]
    type ClientCredit = NonNullable<Client["credits"]>[number]
    type RootAuthorizationOnlyKeys = Extract<keyof Dto, "createdByUserId" | "isDeleted">
    type TagAuthorizationOnlyKeys = Extract<keyof DtoTag, "songId">
    type FileAuthorizationOnlyKeys = Extract<keyof DtoFileAssociation, "fileId" | "songId">
    type CreditAuthorizationOnlyKeys = Extract<keyof DtoCredit, "userId" | "songId">

    expectTypeOf<Dto["aliases"]>().toEqualTypeOf<string>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<TagAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<CreditAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<DtoCredit["publicId"]>().toEqualTypeOf<SongCreditPublicId>()
    expectTypeOf<DtoCredit["typeId"]>().toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<NonNullable<ClientCredit["type"]>["publicId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<ClientTag["tag"]>()
      .toEqualTypeOf<NonNullable<ClientTag["tag"]>>()
    expectTypeOf<ClientFileTag["bandFileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["bandFileTag"]>>()
    expect(db3.songSearchView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songSearchSelection)
  })

  it("derives Song Detail and its embedded File-card graph", () => {
    type Dto = db3.SongDetailDto
    type Client = db3.SongDetailClient
    type DtoTag = NonNullable<Dto["tags"]>[number]
    type DtoFileAssociation = NonNullable<Dto["taggedFiles"]>[number]
    type DtoFile = NonNullable<DtoFileAssociation["file"]>
    type DtoFileSongAssociation = NonNullable<DtoFile["taggedSongs"]>[number]
    type DtoFileSong = NonNullable<DtoFileSongAssociation["song"]>
    type ClientFile = NonNullable<
      NonNullable<Client["taggedFiles"]>[number]["file"]
    >
    type ClientFileTag = NonNullable<ClientFile["tags"]>[number]
    type ClientCredit = NonNullable<Client["credits"]>[number]
    type ClientCreditType = NonNullable<ClientCredit["type"]>
    type RootAuthorizationOnlyKeys = Extract<keyof Dto, "isDeleted">
    type TagAuthorizationOnlyKeys = Extract<keyof DtoTag, "songId">
    type FileAssociationAuthorizationOnlyKeys = Extract<
      keyof DtoFileAssociation,
      "fileId" | "songId"
    >
    type FileAuthorizationOnlyKeys = Extract<keyof DtoFile, "isDeleted">
    type FileSongAuthorizationOnlyKeys = Extract<
      keyof DtoFileSong,
      "createdByUserId" | "visiblePermissionId" | "isDeleted"
    >

    expectTypeOf<Dto["pinnedRecordingId"]>()
      .toEqualTypeOf<FilePublicId | null>()
    expectTypeOf<DtoFile["parentFileId"]>()
      .toEqualTypeOf<FilePublicId | null>()
    expectTypeOf<DtoFile["previewFileId"]>()
      .toEqualTypeOf<FilePublicId | null>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<TagAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileAssociationAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<DtoFileAssociation["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<Extract<keyof DtoFileAssociation, "id">>().toEqualTypeOf<never>()
    expectTypeOf<DtoFileSongAssociation["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<Extract<keyof DtoFileSongAssociation, "id">>().toEqualTypeOf<never>()
    expectTypeOf<FileAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileSongAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["bandFileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["bandFileTag"]>>()
    expectTypeOf<ClientCreditType["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expectTypeOf<ClientCredit["publicId"]>().toEqualTypeOf<SongCreditPublicId>()
    expectTypeOf<ClientCredit["typeId"]>().toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<Extract<keyof db3.SongDetailDto, "createdByUserId">>()
      .toEqualTypeOf<never>()
    expectTypeOf<NonNullable<db3.SongDetailClient["createdByUser"]>["publicId"]>()
      .toEqualTypeOf<UserPublicId>()
    expectTypeOf<ClientCreditType["publicId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
    expect(db3.songDetailView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songDetailSelection)
  })
})

describe("DB3 normalized foreign-single hydration", () => {
  const statusReferences = db3.defineReferenceContract({
    eventStatus: db3.reference(db3.xEventStatus)<{
      publicId: EventStatusPublicId
      caption: string
      render: () => string
    }>(),
  })

  it("declares and resolves a selected foreign key while retaining its transport member", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: statusReferences,
    })
    const statusReference = {
      publicId: eventStatusPublicId,
      caption: "Confirmed",
      render: () => "rendered status",
    }
    const references = new db3.DB3ReferenceStore(statusReferences)
    references.register(db3.xEventStatus, [statusReference])
    const view = db3.defineView({
      viewID: "Test_OpaqueEventStatusReference",
      entity: db3.xEvent,
      selection: derived.prismaSelection,
      dtoSchema: derived.dtoSchema,
      references: derived.referenceContract,
      hydrate: derived.hydrate,
    })

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      statusId?: EventStatusPublicId | null
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      statusId?: EventStatusPublicId | null
      status?: typeof statusReference | null
    }>()
    expectTypeOf<db3.ClientOf<typeof view>>().toEqualTypeOf<{
      statusId?: EventStatusPublicId | null
      status?: typeof statusReference | null
    }>()
    expect(derived.referenceDependencies).toEqual([
      expect.objectContaining({
        sourceTable: db3.xEvent,
        targetTable: db3.xEventStatus,
        foreignKeyMember: "statusId",
        relationMember: "status",
        selectionPath: "Event.select.statusId",
      }),
    ])
    expect(db3.hydrateView(view, { statusId: eventStatusPublicId }, references)).toEqual({
      statusId: eventStatusPublicId,
      status: statusReference,
    })
    if (false) {
      // @ts-expect-error The view promises EventStatus values; an empty provider cannot hydrate it.
      db3.hydrateView(view, { statusId: eventStatusPublicId }, new db3.DB3ReferenceStore())
      // @ts-expect-error The provider contract does not declare EventType values.
      db3.getReference(references, db3.xEventType, 1)
    }
  })

  it("preserves absent and null normalized references without consulting the provider", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: statusReferences,
    })
    const references = new db3.DB3ReferenceStore(statusReferences)
    const requireReference = vi.spyOn(references, "require")

    expect(derived.hydrate({}, references)).toEqual({})
    expect(derived.hydrate({ statusId: null }, references)).toEqual({
      statusId: null,
      status: null,
    })
    expect(requireReference).not.toHaveBeenCalled()
  })

  it("reports the source field, target table and identity for a missing dependency", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: statusReferences,
    })
    const references = new db3.DB3ReferenceStore(statusReferences)
    references.register(db3.xEventStatus, [])

    expect(() => derived.hydrate({
      statusId: eventStatusPublicId,
    }, references)).toThrow(
      `Unable to hydrate Event.statusId: EventStatus '${eventStatusPublicId}' is not available.`,
    )
  })

  it("does not graft a relation when the view declares no reference capability", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const references = new db3.DB3ReferenceStore()
    const requireReference = vi.spyOn(references, "require")

    expect(derived.hydrate({ statusId: eventStatusPublicId }, references)).toEqual({ statusId: eventStatusPublicId })
    expect(derived.referenceDependencies).toEqual([])
    expect(requireReference).not.toHaveBeenCalled()
  })

  it("uses the target xTable identity for public-ID foreign-key transport", () => {
    const selection = Prisma.validator<Prisma.BandInstrumentDefaultArgs>()({
      select: { functionalGroupId: true },
    })
    const groupReferences = db3.defineReferenceContract({
      functionalGroup: db3.reference(db3.xInstrumentFunctionalGroup)<{
        publicId: InstrumentFunctionalGroupPublicId
        displayName: string
      }>(),
    })
    const derived = db3.deriveViewContract(db3.xInstrument, selection, {
      references: groupReferences,
    })
    const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01")
    const group = { publicId, displayName: "Brass" }
    const references = new db3.DB3ReferenceStore(groupReferences)
    references.register(db3.xInstrumentFunctionalGroup, [group])

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      functionalGroupId: InstrumentFunctionalGroupPublicId
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      functionalGroupId: InstrumentFunctionalGroupPublicId
      functionalGroup: typeof group
    }>()
    expect(derived.dtoSchema.safeParse({ functionalGroupId: 54 }).success).toBe(false)
    expect(derived.hydrate({ functionalGroupId: publicId }, references)).toEqual({
      functionalGroupId: publicId,
      functionalGroup: references.require(
        db3.xInstrumentFunctionalGroup,
        publicId,
        "test",
      ),
    })
  })

  it("resolves normalized references inside selected relation collections", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        tags: {
          select: { bandEventTagId: true },
        },
      },
    })
    const tagReferences = db3.defineReferenceContract({
      eventTag: db3.reference(db3.xBandEventTag)<{
        publicId: EventTagPublicId
        caption: string
      }>(),
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: tagReferences,
    })
    const tag = { publicId: eventTagPublicId, caption: "Festival" }
    const references = new db3.DB3ReferenceStore(tagReferences)
    references.register(db3.xBandEventTag, [tag])

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      tags: Array<{
        bandEventTagId: EventTagPublicId
        eventTag: typeof tag
      }>
    }>()
    expect(derived.referenceDependencies).toEqual([
      expect.objectContaining({
        sourceTable: db3.xEventTagAssignment,
        targetTable: db3.xBandEventTag,
        foreignKeyMember: "bandEventTagId",
        relationMember: "eventTag",
        selectionPath: "Event.select.tags.select.bandEventTagId",
      }),
    ])
    expect(derived.hydrate({
      tags: [{ bandEventTagId: eventTagPublicId }],
    }, references)).toEqual({
      tags: [{
        bandEventTagId: eventTagPublicId,
        eventTag: tag,
      }],
    })
  })
})

describe("DB3 derived embedded-relation hydration", () => {
  it("recursively hydrates a nullable foreign-single object", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: {
            publicId: true,
            significance: true,
            color: true,
          },
        },
      },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      status?: {
        publicId: EventStatusPublicId
        significance: string | null
        color: ColorPaletteEntry | null
      } | null
    }>()

    const hydrated = derived.hydrate({
      status: {
        publicId: eventStatusPublicId,
        significance: "FinalConfirmation",
        color: "green",
      },
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      status: {
        publicId: eventStatusPublicId,
        significance: "FinalConfirmation",
        color: expect.objectContaining({ id: "green" }),
      },
    })
    expect(decode).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledWith("green")
  })

  it("preserves absent and null relation edges without invoking nested codecs", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: { color: true },
        },
      },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")
    const references = new db3.DB3ReferenceStore()

    expect(derived.hydrate({}, references)).toEqual({})
    expect(derived.hydrate({ status: null }, references)).toEqual({ status: null })
    expect(decode).not.toHaveBeenCalled()
  })

  it("keeps an explicitly selected relation authoritative over provider grafting", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        statusId: true,
        status: {
          select: { color: true },
        },
      },
    })
    const contract = db3.defineReferenceContract({
      eventStatus: db3.reference(db3.xEventStatus)<{
        publicId: EventStatusPublicId
        caption: string
      }>(),
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: contract,
    })
    const references = new db3.DB3ReferenceStore(contract)
    references.register(db3.xEventStatus, [{
      publicId: eventStatusPublicId,
      caption: "Confirmed",
    }])
    const getReference = vi.spyOn(references, "get")
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")

    expect(derived.hydrate({ statusId: eventStatusPublicId }, references)).toEqual({ statusId: eventStatusPublicId })
    expect(derived.referenceDependencies).toEqual([])
    expect(getReference).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()
  })

  it("recursively hydrates relation collections and their nested relations", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        tags: {
          select: {
            bandEventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                isHidden: true,
                color: true,
              },
            },
          },
        },
      },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const decode = vi.spyOn(db3.xBandEventTag.fields.color.valueField.codec, "decode")

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      tags: Array<{
        bandEventTagId: EventTagPublicId
        eventTag: {
          publicId: EventTagPublicId
          isHidden: boolean
          color: InheritedFieldValue<ColorPaletteEntry | null>
          colorOverride: string | null
          colorInheritedValue: string | null
        }
      }>
    }>()

    const hydrated = derived.hydrate({
      tags: [{
        bandEventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          isHidden: false,
          color: "green", colorOverride: "green", colorInheritedValue: null,
        },
      }],
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      tags: [{
        bandEventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          isHidden: false,
          color: { value: expect.objectContaining({ id: "green" }), override: expect.objectContaining({ id: "green" }), inheritedValue: null },
          colorOverride: "green", colorInheritedValue: null,
        },
      }],
    })
    expect(decode).toHaveBeenCalledTimes(2)
  })

  it("retains localized companions on nested DTOs and validates them before hydration", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { status: { select: { publicId: true, name: true } } },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    type Status = NonNullable<z.infer<typeof derived.dtoSchema>["status"]>
    expectTypeOf<Status["nameResolution"]>().toEqualTypeOf<StringResolution>()
    expectTypeOf<Status["nameStringPublicId"]>().toEqualTypeOf<db3.DtoOf<typeof db3.eventStatusEditorView>["nameStringPublicId"]>()
    const dto = { status: eventStatusDtoFixture(eventStatusPublicId) }
    expect(derived.dtoSchema.safeParse({ status: { publicId: eventStatusPublicId, name: "Confirmed" } }).success).toBe(false)
    expect(derived.hydrate(dto, new db3.DB3ReferenceStore()).status?.name).toMatchObject({ value: "Confirmed", resolution: dto.status.nameResolution })
    expect(derived.hydrate({ status: null }, new db3.DB3ReferenceStore())).toEqual({ status: null })
  })
})
