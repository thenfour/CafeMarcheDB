import { Prisma } from "db"
import type { z } from "zod"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import type { ColorPaletteEntry } from "src/core/components/color/palette"
import * as db3 from "src/core/db3/db3"
import { parsePublicId, type InstrumentFunctionalGroupPublicId } from "shared/publicId"
import { compileDB3Selection } from "src/core/db3/shared/core/db3ViewContract"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DB3 scalar selection compiler", () => {
  it("preserves the Prisma selection and derives required nullable scalar schemas", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        id: true,
        label: true,
        iconName: true,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf(compiled.prismaSelection).toEqualTypeOf<typeof selection>()
    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      id: number
      label: string
      iconName: string | null
    }>()

    expect(compiled.prismaSelection).toBe(selection)
    expect(compiled.members.map(member => ({
      member: member.member,
      required: member.required,
    }))).toEqual([
      { member: "id", required: true },
      { member: "label", required: true },
      { member: "iconName", required: true },
    ])
    expect(compiled.dtoSchema.parse({
      id: 10,
      label: "Confirmed",
      iconName: null,
    })).toEqual({
      id: 10,
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
        name: true,
        locationDescription: true,
      },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      name?: string
      locationDescription?: string
    }>()

    expect(compiled.members.every(member => member.required === false)).toBe(true)
    expect(compiled.dtoSchema.parse({})).toEqual({})
    expect(compiled.dtoSchema.parse({ name: "Visible event" }))
      .toEqual({ name: "Visible event" })
  })

  it("ignores Prisma members explicitly excluded with false", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        id: true,
        label: false,
      },
    })

    const compiled = compileDB3Selection(db3.xEventStatus, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      id: number
    }>()

    expect(compiled.members.map(member => member.member)).toEqual(["id"])
    expect(compiled.dtoSchema.parse({ id: 10, label: "stripped" })).toEqual({ id: 10 })
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

  it("derives normalized foreign-key transport schemas", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      statusId?: number | null
    }>()

    expect(compiled.members[0]).toMatchObject({
      kind: "value",
      ownershipKind: "foreignKey",
      member: "statusId",
    })
    expect(compiled.dtoSchema.parse({ statusId: null })).toEqual({ statusId: null })
    expect(compiled.dtoSchema.parse({ statusId: 12 })).toEqual({ statusId: 12 })
    expect(compiled.dtoSchema.safeParse({ statusId: "12" }).success).toBe(false)
  })

  it("recursively compiles nested foreign-single selections", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: { id: true, label: true },
        },
      },
    })

    const compiled = compileDB3Selection(db3.xEvent, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      status?: {
        id?: number
        label?: string
      } | null
    }>()

    expect(compiled.members[0]).toMatchObject({
      kind: "relation",
      ownershipKind: "foreignObject",
      cardinality: "one",
      member: "status",
    })
    expect(compiled.dtoSchema.parse({ status: null })).toEqual({ status: null })
    expect(compiled.dtoSchema.parse({ status: { id: 4, label: "Confirmed" } }))
      .toEqual({ status: { id: 4, label: "Confirmed" } })
    expect(compiled.dtoSchema.safeParse({
      status: { id: "4", label: "Confirmed" },
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
            eventTagId: true,
            eventTag: {
              select: {
                id: true,
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
        eventTagId: 12,
        eventTag: {
          id: 12,
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
      tags: [{ ...dto.tags[0], eventTagId: "12" }],
    }).success).toBe(false)
  })

  it("derives the selected nested DTO type without widening Prisma arguments", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        locationURL: true,
        tags: {
          select: {
            eventTagId: true,
            eventTag: {
              select: {
                id: true,
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
      locationURL?: string
      tags?: Array<{
        eventTagId?: number
        eventTag?: {
          id?: number
          text?: string
        }
      }>
    }>()
    expect(schema.parse({
      locationURL: "https://example.com",
      tags: [{
        eventTagId: 12,
        eventTag: { id: 12, text: "Festival" },
      }],
    })).toEqual({
      locationURL: "https://example.com",
      tags: [{
        eventTagId: 12,
        eventTag: { id: 12, text: "Festival" },
      }],
    })
  })
})

describe("DB3 derived scalar hydration", () => {
  it("derives distinct DTO and consumer types and decodes each present scalar once", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        id: true,
        label: true,
        color: true,
      },
    })
    const derived = db3.deriveViewContract(db3.xEventStatus, selection)
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")
    const dto = {
      id: 10,
      label: "Confirmed",
      color: "green",
    }

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      id: number
      label: string
      color: string | null
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      id: number
      label: string
      color: ColorPaletteEntry | null
    }>()

    const hydrated = derived.hydrate(dto, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      id: 10,
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

describe("DB3 normalized foreign-single hydration", () => {
  it("declares and resolves a selected foreign key while retaining its transport member", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const status = {
      id: 4,
      label: "Confirmed",
      description: "Public display metadata",
      color: "green",
      sortOrder: 1,
      significance: db3.EventStatusSignificance.FinalConfirmation,
      iconName: null,
      isDeleted: false,
    } satisfies Prisma.EventStatusGetPayload<{}>
    const references = new db3.DB3ReferenceStore()
    references.register(db3.xEventStatus, [status])

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      statusId?: number | null
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      statusId?: number | null
      status?: Prisma.EventStatusGetPayload<{}> | null
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
    expect(derived.hydrate({ statusId: status.id }, references)).toEqual({
      statusId: status.id,
      status,
    })
  })

  it("preserves absent and null normalized references without consulting the provider", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const references = new db3.DB3ReferenceStore()
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
    const derived = db3.deriveViewContract(db3.xEvent, selection)

    expect(() => derived.hydrate({
      statusId: 404,
    }, new db3.DB3ReferenceStore())).toThrow(
      "Unable to hydrate Event.status: EventStatus '404' is not available.",
    )
  })

  it("uses the target xTable identity for public-ID foreign-key transport", () => {
    const selection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
      select: { functionalGroupId: true },
    })
    const derived = db3.deriveViewContract(db3.xInstrument, selection)
    const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01")
    const group: db3.InstrumentFunctionalGroupClientPayload = {
      publicId,
      name: "Brass",
      description: "Brass instruments",
      color: "orange",
      sortOrder: 1,
    }
    const references = new db3.DB3ReferenceStore()
    references.register(db3.xInstrumentFunctionalGroup, [group])

    expectTypeOf<Parameters<typeof derived.hydrate>[0]>().toEqualTypeOf<{
      functionalGroupId?: InstrumentFunctionalGroupPublicId
    }>()
    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      functionalGroupId?: InstrumentFunctionalGroupPublicId
      functionalGroup?: db3.InstrumentFunctionalGroupClientPayload
    }>()
    expect(derived.dtoSchema.safeParse({ functionalGroupId: 54 }).success).toBe(false)
    expect(derived.hydrate({ functionalGroupId: publicId }, references)).toEqual({
      functionalGroupId: publicId,
      functionalGroup: group,
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
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const tag = {
      id: 12,
      text: "Festival",
      description: "Festival event",
      color: "green",
      significance: null,
      sortOrder: 1,
      visibleOnFrontpage: true,
    } satisfies Prisma.EventTagGetPayload<{}>
    const references = new db3.DB3ReferenceStore()
    references.register(db3.xEventTag, [tag])

    expectTypeOf<ReturnType<typeof derived.hydrate>>().toEqualTypeOf<{
      tags?: Array<{
        eventTagId?: number
        eventTag?: Prisma.EventTagGetPayload<{}>
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
      tags: [{ eventTagId: tag.id }],
    }, references)).toEqual({
      tags: [{ eventTagId: tag.id, eventTag: tag }],
    })
  })
})

describe("DB3 derived embedded-relation hydration", () => {
  it("recursively hydrates a nullable foreign-single object", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: {
            id: true,
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
        id?: number
        label?: string
        color?: ColorPaletteEntry | null
      } | null
    }>()

    const hydrated = derived.hydrate({
      status: {
        id: 4,
        label: "Confirmed",
        color: "green",
      },
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      status: {
        id: 4,
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

  it("does not reconstruct an authorization-absent relation from its selected ID", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        statusId: true,
        status: {
          select: { color: true },
        },
      },
    })
    const derived = db3.deriveViewContract(db3.xEvent, selection)
    const references = new db3.DB3ReferenceStore()
    const getReference = vi.spyOn(references, "get")
    const decode = vi.spyOn(db3.xEventStatus.fields.color.codec, "decode")

    expect(derived.hydrate({ statusId: 4 }, references)).toEqual({ statusId: 4 })
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
                id: true,
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
      tags?: Array<{
        eventTagId?: number
        eventTag?: {
          id?: number
          text?: string
          color?: ColorPaletteEntry | null
        }
      }>
    }>()

    const hydrated = derived.hydrate({
      tags: [{
        eventTagId: 12,
        eventTag: {
          id: 12,
          text: "Festival",
          color: "green",
        },
      }],
    }, new db3.DB3ReferenceStore())

    expect(hydrated).toEqual({
      tags: [{
        eventTagId: 12,
        eventTag: {
          id: 12,
          text: "Festival",
          color: expect.objectContaining({ id: "green" }),
        },
      }],
    })
    expect(decode).toHaveBeenCalledTimes(1)
  })
})
