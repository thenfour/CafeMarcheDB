import { Prisma } from "db"
import type { z } from "zod"
import { describe, expect, expectTypeOf, it } from "vitest"

import * as db3 from "src/core/db3/db3"
import { compileDB3Selection } from "src/core/db3/shared/core/db3ViewContract"

describe("DB3 scalar selection compiler", () => {
  it("preserves the Prisma selection and derives required nullable scalar schemas", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        id: true,
        label: true,
        iconName: true,
      },
    })

    const compiled = compileDB3Selection(db3.eventStatusEntity, selection)

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

    const compiled = compileDB3Selection(db3.eventEntity, selection)

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

    const compiled = compileDB3Selection(db3.eventStatusEntity, selection)

    expectTypeOf<z.infer<typeof compiled.dtoSchema>>().toEqualTypeOf<{
      id: number
    }>()

    expect(compiled.members.map(member => member.member)).toEqual(["id"])
    expect(compiled.dtoSchema.parse({ id: 10, label: "stripped" })).toEqual({ id: 10 })
  })

  it("reports the entity and complete path for unknown selected members", () => {
    expect(() => compileDB3Selection(db3.eventStatusEntity, {
      select: { unknownMember: true },
    } as any)).toThrow(
      "DB3 entity 'EventStatus' cannot compile selection path "
      + "'EventStatus.select.unknownMember'",
    )
  })

  it("rejects fields without scalar read contracts", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: { events: true },
    })

    expect(() => compileDB3Selection(db3.eventStatusEntity, selection)).toThrow(
      "'EventStatus.select.events': GhostField field 'events' does not declare "
      + "a read transport schema for its field member 'events'",
    )
  })

  it("derives normalized foreign-key transport schemas", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })

    const compiled = compileDB3Selection(db3.eventEntity, selection)

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

    const compiled = compileDB3Selection(db3.eventEntity, selection)

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

    expect(() => compileDB3Selection(db3.eventEntity, selection)).toThrow(
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
    const compiled = compileDB3Selection(db3.eventEntity, validated)
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

    const schema = db3.deriveDtoSchema(db3.eventEntity, selection)

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
