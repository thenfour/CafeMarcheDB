import type { EventAttendancePublicId } from "shared/publicId";
import { Prisma } from "db"
import { z } from "zod"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import type { ColorPaletteEntry } from "src/core/components/color/palette"
import * as db3 from "src/core/db3/db3"
import { ZodToPrismaSelection } from "shared/prismaUtils"
import {
  parsePublicId,
  type EventStatusPublicId,
  type EventTagAssignmentPublicId,
  type EventTagPublicId,
  type EventTypePublicId,
  type FileTagAssignmentPublicId,
  type FileTagPublicId,
  type FileEventTagPublicId,
  type FileInstrumentTagPublicId,
  type FileSongTagPublicId,
  type FileUserTagPublicId,
  type FileWikiPageTagPublicId,
  type InstrumentFunctionalGroupPublicId,
  type SongCreditPublicId,
  type SongCreditTypePublicId,
  type SongTagPublicId,
  type UserTagPublicId,
  type UserTagAssignmentPublicId,
  type WikiPageTagAssignmentPublicId,
  type WikiPageTagPublicId,
} from "shared/publicId"
import type { DateTimeRange } from "shared/time"
import { compileDB3Selection } from "src/core/db3/shared/core/db3ViewContract"
import { PermissionSet } from "src/auth/shared/PermissionSet"

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
      associationForeignObjectMember: "eventTag",
      associationLocalObjectMember: "event",
      authMap: db3.xEventAuthMap_Homepage,
      getQuickFilterWhereClause: () => false,
      getCustomFilterWhereClause: () => false,
    } as const

    const factory = db3.tagsRef("EventTagAssignment", "EventTag", args)
    expect(factory("tags").foreignTableID).toBe("EventTag")

    if (false) {
      // @ts-expect-error The foreign table must be the target of eventTag.
      db3.tagsRef("EventTagAssignment", "UserTag", args)
      // @ts-expect-error Association IDs must be registered Prisma model IDs.
      db3.tagsRef("eventTagAssignment", "EventTag", args)
      // @ts-expect-error Local members must be Prisma relations backed by `${member}Id`.
      db3.tagsRef("EventTagAssignment", "EventTag", { ...args, associationLocalObjectMember: "notARelation" })
      // @ts-expect-error TagsField construction is intentionally restricted to tagsRef().
      new db3.TagsField({} as never)
    }
  })

  it("derives the finite Event Search relation graph without recursive widening", () => {
    const selection = db3.eventSearchSelection({
      filter: { items: [] },
      authorization: db3.createDB3Authorization(null, new PermissionSet([])),
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
      .toEqualTypeOf<typeof db3.xWikiPageRevision>()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationTableID>()
      .toEqualTypeOf<"EventTagAssignment">()
    expectTypeOf<typeof db3.xEvent.fields.tags.foreignTableID>()
      .toEqualTypeOf<"EventTag">()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationLocalIDMember>()
      .toEqualTypeOf<"eventId">()
    expectTypeOf<typeof db3.xEvent.fields.tags.associationForeignIDMember>()
      .toEqualTypeOf<"eventTagId">()
    expectTypeOf<Segment>().toEqualTypeOf<{
      id: number
      name?: string
      startsAt?: Date | null
      durationMillis?: bigint
      isAllDay?: boolean
      statusId?: EventStatusPublicId | null
      responses?: Array<{
        id: number
        userId?: number
        attendanceId?: EventAttendancePublicId | null
      }>
    }>()
    expectTypeOf<SegmentResponse["id"]>().toEqualTypeOf<number>()
    expectTypeOf<EventResponse["id"]>().toEqualTypeOf<number>()
    expectTypeOf<TransportDto["name"]>().toEqualTypeOf<string>()
    expectTypeOf<TransportDto["tags"]>().toBeArray()
    expectTypeOf<ContentIsAny>().toEqualTypeOf<false>()
    expectTypeOf<CurrentRevision["content"]>().toEqualTypeOf<string | undefined>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<WikiAuthorizationOnlyKeys>().toEqualTypeOf<never>()
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
    type FileTagIsAny = 0 extends (1 & ClientTag["fileTag"]) ? true : false

    expectTypeOf<DtoTag["publicId"]>().toEqualTypeOf<FileTagAssignmentPublicId>()
    expectTypeOf<DtoTag["fileTagId"]>().toEqualTypeOf<FileTagPublicId>()
    expectTypeOf<Extract<keyof DtoTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<DtoSongTag["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<DtoEventTag["publicId"]>().toEqualTypeOf<FileEventTagPublicId>()
    expectTypeOf<DtoInstrumentTag["publicId"]>().toEqualTypeOf<FileInstrumentTagPublicId>()
    expectTypeOf<DtoWikiPageTag["publicId"]>().toEqualTypeOf<FileWikiPageTagPublicId>()
    expectTypeOf<Extract<keyof DtoSongTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoEventTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoInstrumentTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoWikiPageTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<ClientTag["fileTag"]>()
      .toEqualTypeOf<NonNullable<ClientTag["fileTag"]>>()
    expectTypeOf<ClientSongTag["song"]>()
      .toEqualTypeOf<NonNullable<ClientSongTag["song"]>>()
    expectTypeOf<ClientEventTag["event"]>()
      .toEqualTypeOf<NonNullable<ClientEventTag["event"]>>()
    expectTypeOf<ClientInstrumentTag["instrument"]>()
      .toEqualTypeOf<NonNullable<ClientInstrumentTag["instrument"]>>()
    expectTypeOf<ClientWikiPageTag["wikiPage"]>()
      .toEqualTypeOf<NonNullable<ClientWikiPageTag["wikiPage"]>>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<SongAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileTagIsAny>().toEqualTypeOf<false>()
  })

  it("derives transport DTOs from a fetched selection subset", () => {
    const prismaSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        id: true,
        isDeleted: true,
      },
    })
    const transportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { id: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, prismaSelection, {
      transportSelection,
    })

    expectTypeOf(derived.prismaSelection).toEqualTypeOf<typeof prismaSelection>()
    expectTypeOf<z.infer<typeof derived.dtoSchema>>().toEqualTypeOf<{ id: number }>()
    expect(derived.dtoSchema.parse({ id: 1, isDeleted: false })).toEqual({ id: 1 })
  })

  it("rejects transport members absent from the Prisma selection", () => {
    const prismaSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { id: true },
    })
    const transportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { id: true, name: true },
    })

    expect(() => db3.deriveViewContract(db3.xEvent, prismaSelection, {
      transportSelection,
    })).toThrow(
      "'Event.select.name': transport selection member is not fetched by the Prisma selection",
    )
  })

  it("preserves the Prisma selection and derives required nullable scalar schemas", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        publicId: true,
        label: true,
        iconName: true,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf(compiled.prismaSelection).toEqualTypeOf<typeof selection>()
    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      label: string
      iconName: string | null
    }>()

    expect(compiled.prismaSelection).toBe(selection)
    expect(compiled.members.map(member => ({
      member: member.member,
      required: member.required,
    }))).toEqual([
      { member: "publicId", required: true },
      { member: "label", required: true },
      { member: "iconName", required: true },
    ])
    expect(compiled.dtoSchema.parse({
      publicId: eventStatusPublicId,
      label: "Confirmed",
      iconName: null,
    })).toEqual({
      publicId: eventStatusPublicId,
      label: "Confirmed",
      iconName: null,
    })
    expect(compiled.dtoSchema.safeParse({ id: 10, iconName: null }).success).toBe(false)
    expect(compiled.dtoSchema.safeParse({
      id: 10,
      label: "Confirmed",
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
        label: false,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
    }>()

    expect(compiled.members.map(member => member.member)).toEqual(["publicId"])
    expect(compiled.dtoSchema.parse({ publicId: eventStatusPublicId, label: "stripped" })).toEqual({ publicId: eventStatusPublicId })
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
    const selection = Prisma.validator<Prisma.UserTagDefaultArgs>()({
      select: {
        userAssignments: {
          select: { userId: true },
        },
      },
    })

    const compiled = compileDB3Selection(db3.xUserTag, selection)
    type Dto = z.infer<typeof compiled.dtoSchema>

    expectTypeOf<Dto["userAssignments"]>().toEqualTypeOf<{
      userId?: number
    }[] | undefined>()
    expect(compiled.dtoSchema.parse({ userAssignments: [{ userId: 12 }] }))
      .toEqual({ userAssignments: [{ userId: 12 }] })
    expect(compiled.dtoSchema.safeParse({
      userAssignments: [{ userId: "12" }],
    }).success).toBe(false)
    expect(compiled.dtoSchema.safeParse({
      userAssignments: [{ userId: null }],
    }).success).toBe(false)
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
        status: { select: { publicId: true } },
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
          select: { publicId: true, label: true },
        },
      },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      status?: {
        publicId: EventStatusPublicId
        label: string
      } | null
    }>()

    expect(compiled.members[0]).toMatchObject({
      kind: "relation",
      ownershipKind: "foreignObject",
      cardinality: "one",
      member: "status",
    })
    expect(compiled.dtoSchema.parse({ status: null })).toEqual({ status: null })
    expect(compiled.dtoSchema.parse({ status: { publicId: eventStatusPublicId, label: "Confirmed" } }))
      .toEqual({ status: { publicId: eventStatusPublicId, label: "Confirmed" } })
    expect(compiled.dtoSchema.safeParse({
      status: { publicId: 4, label: "Confirmed" },
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
            eventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                text: true,
              },
            },
          },
          orderBy: {
            eventTagId: "asc"
          },
          where: {
            eventTagId: { gt: 0 },
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
        eventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          text: "Festival",
        },
      }],
    }

    expect(compiled.prismaSelection).toBe(validated)
    expect(compiled.prismaSelection.select?.tags).toMatchObject({
      orderBy: { eventTagId: "asc" },
      where: { eventTagId: { gt: 0 } },
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
      tags: [{ ...dto.tags[0], eventTagId: 12 }],
    }).success).toBe(false)
  })

  it("derives the selected nested DTO type without widening Prisma arguments", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        locationURL: true,
        tags: {
          select: {
            publicId: true,
            eventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                text: true,
              },
            },
          },
          orderBy: { eventTagId: "asc" },
          where: { eventTagId: { gt: 0 } },
        },
      },
    })

    const schema = db3.deriveDtoSchema(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<{
      locationURL: string
      tags: Array<{
        publicId: EventTagAssignmentPublicId
        eventTagId: EventTagPublicId
        eventTag: {
          publicId: EventTagPublicId
          text: string
        }
      }>
    }>()
    expect(schema.parse({
      locationURL: "https://example.com",
      tags: [{
        publicId: eventTagAssignmentPublicId,
        eventTagId: eventTagPublicId,
        eventTag: { publicId: eventTagPublicId, text: "Festival" },
      }],
    })).toEqual({
      locationURL: "https://example.com",
      tags: [{
        publicId: eventTagAssignmentPublicId,
        eventTagId: eventTagPublicId,
        eventTag: { publicId: eventTagPublicId, text: "Festival" },
      }],
    })
  })
})

describe("DB3 derived scalar hydration", () => {
  it("derives distinct DTO and consumer types and decodes each present scalar once", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        publicId: true,
        label: true,
        color: true,
      },
    })
    const derived = db3.deriveViewContract(db3.xEventStatus, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")
    const dto = {
      publicId: eventStatusPublicId,
      label: "Confirmed",
      color: "green",
    }

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      label: string
      color: string | null
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      label: string
      color: ColorPaletteEntry | null
    }>()

    const hydrated = derived.hydrate(dto, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      publicId: eventStatusPublicId,
      label: "Confirmed",
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

describe("EventStatus editor derived-view pilot", () => {
  const legacyDtoSchema = z.object({
    publicId: z.custom<EventStatusPublicId>(value => typeof value === "string"),
    isDeleted: z.boolean().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    iconName: z.string().nullable().optional(),
    label: z.string().optional(),
    significance: z.string().nullable().optional(),
  })

  it("preserves the view identity and former DTO-derived Prisma selection", () => {
    expect(db3.eventStatusEditorView.viewID).toBe("EventStatus_Editor")
    expect(db3.eventStatusEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.eventStatusEditorSelection)
    expect(db3.eventStatusEditorSelection).toEqual(
      ZodToPrismaSelection(legacyDtoSchema),
    )
  })

  it("strengthens inherited DTO presence while retaining transport nullability", () => {
    type LegacyDto = z.infer<typeof legacyDtoSchema>
    type DerivedDto = db3.DtoOf<typeof db3.eventStatusEditorView>

    expectTypeOf<DerivedDto>().toMatchTypeOf<LegacyDto>()
    expectTypeOf<DerivedDto>().toEqualTypeOf<{
      publicId: EventStatusPublicId
      isDeleted: boolean
      description: string
      color: string | null
      sortOrder: number
      iconName: string | null
      label: string
      significance: string | null
    }>()
    expectTypeOf<db3.ClientOf<typeof db3.eventStatusEditorView>>()
      .toEqualTypeOf<{
        publicId: EventStatusPublicId
        isDeleted: boolean
        description: string
        color: ColorPaletteEntry | null
        sortOrder: number
        iconName: string | null
        label: string
        significance: string | null
      }>()

    expect(legacyDtoSchema.safeParse({ publicId: eventStatusPublicId }).success).toBe(true)
    expect(db3.eventStatusEditorView.dtoSchema.safeParse({ publicId: eventStatusPublicId }).success)
      .toBe(false)
    expect(db3.eventStatusEditorView.dtoSchema.safeParse({
      publicId: eventStatusPublicId,
      isDeleted: false,
      description: "Public display metadata",
      color: null,
      sortOrder: 1,
      iconName: null,
      label: "Confirmed",
      significance: null,
    }).success).toBe(true)
  })

  it("matches the former xTable hydrator for a complete DTO", () => {
    const dto: db3.DtoOf<typeof db3.eventStatusEditorView> = {
      publicId: eventStatusPublicId,
      isDeleted: false,
      description: "Public display metadata",
      color: "green",
      sortOrder: 1,
      iconName: null,
      label: "Confirmed",
      significance: db3.EventStatusSignificance.FinalConfirmation,
    }

    expect(db3.eventStatusEditorView.hydrate(
      dto,
      new db3.DB3ReferenceStore(),
    )).toEqual(db3.xEventStatus.getClientModel(dto, "view"))
  })
})

describe("Event lookup editor derived-view rollout", () => {
  it("migrates EventType with required intrinsic fields and codec hydration", () => {
    type Dto = db3.DtoOf<typeof db3.eventTypeEditorView>
    type Client = db3.ClientOf<typeof db3.eventTypeEditorView>

    expectTypeOf<Dto>().toEqualTypeOf<{
      publicId: EventTypePublicId
      isDeleted: boolean
      description: string
      color: string | null
      sortOrder: number
      iconName: string | null
      text: string
      significance: string | null
    }>()
    expectTypeOf<Client["color"]>().toEqualTypeOf<ColorPaletteEntry | null>()
    expect(db3.eventTypeEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.eventTypeEditorSelection)

    const dto: Dto = {
      publicId: eventTypePublicId,
      isDeleted: false,
      description: "Public concert",
      color: "green",
      sortOrder: 1,
      iconName: null,
      text: "Concert",
      significance: db3.EventTypeSignificance.Concert,
    }
    expect(db3.eventTypeEditorView.hydrate(
      dto,
      new db3.DB3ReferenceStore(),
    )).toEqual(db3.xEventType.getClientModel(dto, "view"))
  })

  it("migrates EventTag with required intrinsic fields and codec hydration", () => {
    type Dto = db3.DtoOf<typeof db3.eventTagEditorView>
    type Client = db3.ClientOf<typeof db3.eventTagEditorView>

    expectTypeOf<Dto>().toEqualTypeOf<{
      publicId: EventTagPublicId
      description: string
      color: string | null
      sortOrder: number
      text: string
      significance: string | null
      visibleOnFrontpage: boolean
    }>()
    expectTypeOf<Client["color"]>().toEqualTypeOf<ColorPaletteEntry | null>()
    expect(db3.eventTagEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.eventTagEditorSelection)

    const dto: Dto = {
      publicId: eventTagPublicId,
      description: "Public event",
      color: "orange",
      sortOrder: 1,
      text: "Public",
      significance: null,
      visibleOnFrontpage: true,
    }
    expect(db3.eventTagEditorView.hydrate(
      dto,
      new db3.DB3ReferenceStore(),
    )).toEqual(db3.xEventTag.getClientModel(dto, "view"))
  })
})

describe("UserTag Event search derived-view migration", () => {
  it("uses public identity in administration, dashboard, and user associations", () => {
    type TagDto = db3.DtoOf<typeof db3.userTagEditorView>
    type DashboardTag = db3.UserTagDashboardClient
    type UserDto = db3.DtoOf<typeof db3.userEditorView>
    type Assignment = NonNullable<UserDto["tags"]>[number]

    expectTypeOf<TagDto["publicId"]>().toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<DashboardTag["publicId"]>().toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<Assignment["publicId"]>()
      .toEqualTypeOf<UserTagAssignmentPublicId>()
    expectTypeOf<NonNullable<Assignment["userTagId"]>>()
      .toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<NonNullable<Assignment["userTag"]>["publicId"]>()
      .toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<Extract<keyof TagDto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof Assignment, "id">>().toEqualTypeOf<never>()
    expect(db3.xUserTag.getIdentity({ publicId: userTagPublicId })).toBe(userTagPublicId)
    expect(db3.xUserTagAssignment.getIdentity({ publicId: userTagAssignmentPublicId }))
      .toBe(userTagAssignmentPublicId)
  })

  it("keeps the relation shape on a named view over canonical xUserTag", () => {
    type Dto = db3.DtoOf<typeof db3.userTagEventSearchView>
    type Client = db3.ClientOf<typeof db3.userTagEventSearchView>

    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<Dto["userAssignments"]>().toEqualTypeOf<{
      userId?: number
    }[] | undefined>()
    expectTypeOf<Client["publicId"]>().toEqualTypeOf<UserTagPublicId>()
    expectTypeOf<Client["text"]>().toEqualTypeOf<string>()
    expectTypeOf<Client["userAssignments"]>().toEqualTypeOf<{
      userId?: number
    }[] | undefined>()
    expect(db3.userTagEventSearchView.entity).toBe(db3.xUserTag)
    expect(db3.userTagEventSearchView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.userTagEventSearchSelection)

    const dto: Dto = {
      publicId: userTagPublicId,
      text: "Members",
      userAssignments: [{ userId: 42 }],
    }
    expect(db3.userTagEventSearchView.hydrate(
      dto,
      new db3.DB3ReferenceStore(),
    )).toEqual(dto)
  })
})

describe("Wiki page tag derived-view migration", () => {
  const tagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001")
  const assignmentPublicId = parsePublicId<"WikiPageTagAssignment">("WikiTagAssign001")

  it("uses public identities in tag administration and page association DTOs", () => {
    type TagDto = db3.DtoOf<typeof db3.wikiPageTagEditorView>
    type EditorDto = db3.WikiPageEditorDto
    type SearchDto = db3.WikiPageSearchDto
    type EditorAssignment = NonNullable<EditorDto["tags"]>[number]
    type SearchAssignment = NonNullable<SearchDto["tags"]>[number]

    expectTypeOf<TagDto["publicId"]>().toEqualTypeOf<WikiPageTagPublicId>()
    expectTypeOf<Extract<keyof TagDto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<EditorAssignment["publicId"]>()
      .toEqualTypeOf<WikiPageTagAssignmentPublicId>()
    expectTypeOf<NonNullable<EditorAssignment["tagId"]>>()
      .toEqualTypeOf<WikiPageTagPublicId>()
    expectTypeOf<Extract<keyof EditorAssignment, "id" | "tag">>()
      .toEqualTypeOf<never>()
    expectTypeOf<SearchAssignment>().toEqualTypeOf<EditorAssignment>()
  })

  it("hydrates page-tag associations from the dashboard reference contract", () => {
    const references = db3.createDashboardReferenceStore()
    const tag: db3.CompleteWikiPageTagDashboardClient = {
      publicId: tagPublicId,
      text: "Policy",
      description: "Policy page",
      color: null,
      significance: null,
      sortOrder: 1,
    }
    db3.registerDashboardReferences(references, { wikiPageTag: [tag] })

    const dto = db3.wikiPageEditorView.parseDto({
      id: 12,
      tags: [{ publicId: assignmentPublicId, tagId: tagPublicId }],
    })
    const hydrated = db3.hydrateView(db3.wikiPageEditorView, dto, references)

    expect(hydrated.tags).toEqual([{
      publicId: assignmentPublicId,
      tagId: tagPublicId,
      tag,
    }])
  })
})

describe("File derived-view migration", () => {
  it("derives File Tag transport and consumer codecs", () => {
    type Dto = db3.DtoOf<typeof db3.fileTagEditorView>
    type Client = db3.ClientOf<typeof db3.fileTagEditorView>

    expectTypeOf<Dto["publicId"]>().toEqualTypeOf<FileTagPublicId>()
    expectTypeOf<Extract<keyof Dto, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Dto["text"]>().toEqualTypeOf<string>()
    expectTypeOf<Dto["color"]>()
      .toEqualTypeOf<string | null>()
    expectTypeOf<Client["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expect(db3.fileTagEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.fileTagEditorSelection)
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
      id: number
      fileLeafName?: string
    }>()
    expectTypeOf<PinnedSongDto>().toEqualTypeOf<{
      id: number
      name: string
    }>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<RelatedAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<PinnedAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<DtoUserTag["publicId"]>().toEqualTypeOf<FileUserTagPublicId>()
    expectTypeOf<DtoSongTag["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<DtoEventTag["publicId"]>().toEqualTypeOf<FileEventTagPublicId>()
    expectTypeOf<DtoInstrumentTag["publicId"]>().toEqualTypeOf<FileInstrumentTagPublicId>()
    expectTypeOf<DtoWikiPageTag["publicId"]>().toEqualTypeOf<FileWikiPageTagPublicId>()
    expectTypeOf<Extract<keyof DtoUserTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoSongTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoEventTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoInstrumentTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof DtoWikiPageTag, "id">>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["fileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["fileTag"]>>()
    expectTypeOf<ClientUserTag["user"]>()
      .toEqualTypeOf<NonNullable<ClientUserTag["user"]>>()
    expectTypeOf<ClientSongTag["song"]>()
      .toEqualTypeOf<NonNullable<ClientSongTag["song"]>>()
    expectTypeOf<ClientEventTag["event"]>()
      .toEqualTypeOf<NonNullable<ClientEventTag["event"]>>()
    expectTypeOf<ClientInstrumentTag["instrument"]>()
      .toEqualTypeOf<NonNullable<ClientInstrumentTag["instrument"]>>()
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

    expectTypeOf<Dto["id"]>().toEqualTypeOf<number>()
    expectTypeOf<Dto["isDeleted"]>()
      .toEqualTypeOf<boolean>()
    expectTypeOf<Dto["customData"]>()
      .toEqualTypeOf<string | null | undefined>()
    expectTypeOf<DetailOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["fileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["fileTag"]>>()
    expect(db3.fileEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.fileEditorSelection)
  })
})

describe("Song derived-view migration", () => {
  it("preserves exact nullable transport typing for primitive ghost fields", () => {
    const selection = Prisma.validator<Prisma.SongDefaultArgs>()({
      select: { pinnedRecordingId: true },
    })
    const derived = db3.deriveViewContract(db3.xSong, selection)
    type Dto = z.infer<typeof derived.dtoSchema>

    expectTypeOf<Dto>().toEqualTypeOf<{
      pinnedRecordingId: number | null
    }>()
    expect(derived.dtoSchema.parse({ pinnedRecordingId: null }))
      .toEqual({ pinnedRecordingId: null })
    expect(derived.dtoSchema.parse({ pinnedRecordingId: 12 }))
      .toEqual({ pinnedRecordingId: 12 })
    expect(derived.dtoSchema.safeParse({ pinnedRecordingId: "12" }).success)
      .toBe(false)
  })

  it("derives the Song metadata and credit editor contracts", () => {
    type TagDto = db3.DtoOf<typeof db3.songTagEditorView>
    type TagClient = db3.ClientOf<typeof db3.songTagEditorView>
    type CreditTypeDto = db3.DtoOf<typeof db3.songCreditTypeEditorView>
    type CreditTypeClient = db3.ClientOf<typeof db3.songCreditTypeEditorView>
    type CreditDto = db3.DtoOf<typeof db3.songCreditEditorView>
    type CreditClient = db3.ClientOf<typeof db3.songCreditEditorView>
    type NestedCreditTypeDto = NonNullable<CreditDto["type"]>
    type NestedCreditTypeClient = NonNullable<CreditClient["type"]>

    expectTypeOf<TagDto["publicId"]>().toEqualTypeOf<SongTagPublicId>()
    expectTypeOf<TagDto["text"]>().toEqualTypeOf<string>()
    expectTypeOf<TagDto["color"]>().toEqualTypeOf<string | null>()
    expectTypeOf<TagClient["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
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
      .toEqualTypeOf<number | null>()
    expectTypeOf<CreditDto["songId"]>().toEqualTypeOf<number>()
    expectTypeOf<NestedCreditTypeDto["color"]>()
      .toEqualTypeOf<string | null>()
    expectTypeOf<NestedCreditTypeDto["publicId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
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
    )).toBe(db3.songTagEditorSelection)
    expect(db3.songCreditTypeEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songCreditTypeEditorSelection)
    expect(db3.songCreditEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songCreditEditorSelection)
  })

  it("derives Song Editor nested transport and consumer codecs", () => {
    type Dto = db3.DtoOf<typeof db3.songEditorView>
    type Client = db3.ClientOf<typeof db3.songEditorView>
    type PermissionDto = NonNullable<Dto["visiblePermission"]>
    type PermissionClient = NonNullable<Client["visiblePermission"]>
    type TagDto = NonNullable<NonNullable<Dto["tags"]>[number]["tag"]>
    type TagClient = NonNullable<NonNullable<Client["tags"]>[number]["tag"]>

    expectTypeOf<Dto["id"]>().toEqualTypeOf<number>()
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
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expect(db3.songEditorView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songEditorSelection)
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
    expectTypeOf<ClientFileTag["fileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["fileTag"]>>()
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
      .toEqualTypeOf<number | null>()
    expectTypeOf<DtoFile["parentFileId"]>()
      .toEqualTypeOf<number | null>()
    expectTypeOf<DtoFile["previewFileId"]>()
      .toEqualTypeOf<number | null>()
    expectTypeOf<RootAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<TagAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileAssociationAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<DtoFileAssociation["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<Extract<keyof DtoFileAssociation, "id">>().toEqualTypeOf<never>()
    expectTypeOf<DtoFileSongAssociation["publicId"]>().toEqualTypeOf<FileSongTagPublicId>()
    expectTypeOf<Extract<keyof DtoFileSongAssociation, "id">>().toEqualTypeOf<never>()
    expectTypeOf<FileAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<FileSongAuthorizationOnlyKeys>().toEqualTypeOf<never>()
    expectTypeOf<ClientFileTag["fileTag"]>()
      .toEqualTypeOf<NonNullable<ClientFileTag["fileTag"]>>()
    expectTypeOf<ClientCreditType["color"]>()
      .toEqualTypeOf<ColorPaletteEntry | null>()
    expectTypeOf<ClientCredit["publicId"]>().toEqualTypeOf<SongCreditPublicId>()
    expectTypeOf<ClientCredit["typeId"]>().toEqualTypeOf<SongCreditTypePublicId>()
    expectTypeOf<ClientCreditType["publicId"]>()
      .toEqualTypeOf<SongCreditTypePublicId>()
    expect(db3.songDetailView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.songDetailSelection)
  })
})

describe("Event frontpage derived-view migration", () => {
  const makeDto = (): db3.EventFrontpageDto => ({
    id: 41,
    name: "Autumn concert",
    typeId: eventTypePublicId,
    locationDescription: "Town hall",
    locationURL: "https://example.com",
    statusId: eventStatusPublicId,
    relevanceClassOverride: null,
    startsAt: new Date("2026-10-03T18:00:00.000Z"),
    durationMillis: BigInt(7_200_000),
    isAllDay: false,
    visiblePermissionId: permissionPublicId,
    frontpageVisible: true,
    frontpageDate: "3 October",
    frontpageTime: "20:00",
    frontpageDetails: "Doors at 19:30",
    frontpageTitle: "Autumn concert",
    frontpageLocation: "Town hall",
    frontpageLocationURI: "https://example.com/venue",
    frontpageTags: "#concert",
    frontpageDate_nl: "3 oktober",
    frontpageTime_nl: "20:00",
    frontpageDetails_nl: "Deuren om 19:30",
    frontpageTitle_nl: "Herfstconcert",
    frontpageLocation_nl: "Stadhuis",
    frontpageLocationURI_nl: "https://example.com/venue",
    frontpageTags_nl: "#concert",
    frontpageDate_fr: "3 octobre",
    frontpageTime_fr: "20:00",
    frontpageDetails_fr: "Portes a 19:30",
    frontpageTitle_fr: "Concert d'automne",
    frontpageLocation_fr: "Hotel de ville",
    frontpageLocationURI_fr: "https://example.com/venue",
    frontpageTags_fr: "#concert",
    type: {
      publicId: eventTypePublicId,
      isDeleted: false,
      description: "Public concert",
      color: "green",
      sortOrder: 1,
      iconName: null,
      text: "Concert",
      significance: db3.EventTypeSignificance.Concert,
    },
    status: {
      publicId: eventStatusPublicId,
      isDeleted: false,
      description: "Public status",
      color: "blue",
      sortOrder: 1,
      iconName: null,
      label: "Confirmed",
      significance: db3.EventStatusSignificance.FinalConfirmation,
    },
    tags: [{
      publicId: eventTagAssignmentPublicId,
      eventTagId: eventTagPublicId,
      eventTag: {
        publicId: eventTagPublicId,
        description: "Public event",
        color: "orange",
        sortOrder: 1,
        visibleOnFrontpage: true,
        text: "Public",
        significance: null,
      },
    }],
  })

  it("preserves the named Prisma selection and derives inherited presence", () => {
    type Dto = db3.EventFrontpageDto
    type Client = db3.EventFrontpageClient

    expect(db3.eventFrontpageView.viewID).toBe("Event_Frontpage")
    expect(db3.eventFrontpageView.getSelectionArgs(
      {} as db3.DB3ViewSelectionContext,
    )).toBe(db3.eventFrontpageSelection)
    expect(db3.eventFrontpageSelection.select.tags.orderBy)
      .toBe(db3.EventTagAssignmentNaturalOrderBy)

    expectTypeOf<Pick<Dto,
      | "id"
      | "name"
      | "locationDescription"
      | "locationURL"
      | "startsAt"
      | "durationMillis"
      | "isAllDay"
      | "frontpageVisible"
      | "frontpageTitle"
    >>().toEqualTypeOf<{
      id: number
      name: string
      locationDescription: string
      locationURL: string
      startsAt: Date | null
      durationMillis: bigint
      isAllDay: boolean
      frontpageVisible: boolean
      frontpageTitle: string | null
    }>()
    expectTypeOf<NonNullable<Dto["type"]>>().toEqualTypeOf<{
      publicId: EventTypePublicId
      isDeleted: boolean
      description: string
      color: string | null
      sortOrder: number
      iconName: string | null
      text: string
      significance: string | null
    }>()
    expectTypeOf<Client>().toMatchTypeOf<{ dateRange: DateTimeRange }>()
    expectTypeOf<Extract<
      keyof Client,
      "startsAt" | "durationMillis" | "isAllDay"
    >>().toEqualTypeOf<never>()

    const dto = makeDto()
    const { name: _name, ...withoutName } = dto
    expect(db3.eventFrontpageView.dtoSchema.safeParse(withoutName).success)
      .toBe(false)
    expect(db3.eventFrontpageView.dtoSchema.safeParse({
      ...dto,
      type: { ...dto.type!, text: undefined },
    }).success).toBe(false)
  })

  it("hydrates embedded codecs and composes the date range without references", () => {
    const typeColorDecode = vi.spyOn(db3.xEventType.fields.color.codec, "decode")
    const statusColorDecode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")
    const tagColorDecode = vi.spyOn(db3.xEventTag.fields.color.codec, "decode")

    const hydrated = db3.eventFrontpageView.hydrate(
      makeDto(),
      new db3.DB3ReferenceStore(),
    )

    expect(hydrated.dateRange.getSpec()).toEqual({
      startsAtDateTime: new Date("2026-10-03T18:00:00.000Z"),
      durationMillis: 7_200_000,
      isAllDay: false,
    })
    expect(hydrated).not.toHaveProperty("startsAt")
    expect(hydrated).not.toHaveProperty("durationMillis")
    expect(hydrated).not.toHaveProperty("isAllDay")
    expect(hydrated).not.toHaveProperty("visiblePermission")
    expect(hydrated.type?.color).toEqual(expect.objectContaining({ id: "green" }))
    expect(hydrated.status?.color).toEqual(expect.objectContaining({ id: "blue" }))
    expect(hydrated.tags?.[0]?.eventTag.color)
      .toEqual(expect.objectContaining({ id: "orange" }))
    expect(typeColorDecode).toHaveBeenCalledTimes(1)
    expect(statusColorDecode).toHaveBeenCalledTimes(1)
    expect(tagColorDecode).toHaveBeenCalledTimes(1)
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
    const selection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
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
          select: { eventTagId: true },
        },
      },
    })
    const tagReferences = db3.defineReferenceContract({
      eventTag: db3.reference(db3.xEventTag)<{
        publicId: EventTagPublicId
        caption: string
      }>(),
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection, {
      references: tagReferences,
    })
    const tag = { publicId: eventTagPublicId, caption: "Festival" }
    const references = new db3.DB3ReferenceStore(tagReferences)
    references.register(db3.xEventTag, [tag])

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      tags: Array<{
        eventTagId: EventTagPublicId
        eventTag: typeof tag
      }>
    }>()
    expect(derived.referenceDependencies).toEqual([
      expect.objectContaining({
        sourceTable: db3.xEventTagAssignment,
        targetTable: db3.xEventTag,
        foreignKeyMember: "eventTagId",
        relationMember: "eventTag",
        selectionPath: "Event.select.tags.select.eventTagId",
      }),
    ])
    expect(derived.hydrate({
      tags: [{ eventTagId: eventTagPublicId }],
    }, references)).toEqual({
      tags: [{
        eventTagId: eventTagPublicId,
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
            label: true,
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
        label: string
        color: ColorPaletteEntry | null
      } | null
    }>()

    const hydrated = derived.hydrate({
      status: {
        publicId: eventStatusPublicId,
        label: "Confirmed",
        color: "green",
      },
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      status: {
        publicId: eventStatusPublicId,
        label: "Confirmed",
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
            eventTagId: true,
            eventTag: {
              select: {
                publicId: true,
                text: true,
                color: true,
              },
            },
          },
        },
      },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const decode = vi.spyOn(db3.xEventTag.fields.color.codec, "decode")

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      tags: Array<{
        eventTagId: EventTagPublicId
        eventTag: {
          publicId: EventTagPublicId
          text: string
          color: ColorPaletteEntry | null
        }
      }>
    }>()

    const hydrated = derived.hydrate({
      tags: [{
        eventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          text: "Festival",
          color: "green",
        },
      }],
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      tags: [{
        eventTagId: eventTagPublicId,
        eventTag: {
          publicId: eventTagPublicId,
          text: "Festival",
          color: expect.objectContaining({ id: "green" }),
        },
      }],
    })
    expect(decode).toHaveBeenCalledTimes(1)
  })
})
