import { Prisma } from "db"
import { describe, expect, it } from "vitest"

import * as db3 from "src/core/db3/db3"
import { compileDB3ScalarSelection } from "src/core/db3/shared/core/db3ViewContract"

describe("DB3 scalar selection compiler", () => {
  it("preserves the Prisma selection and derives required nullable scalar schemas", () => {
    const selection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
      select: {
        id: true,
        label: true,
        iconName: true,
      },
    })

    const compiled = compileDB3ScalarSelection(db3.eventStatusEntity, selection)

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

    const compiled = compileDB3ScalarSelection(db3.eventEntity, selection)

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

    const compiled = compileDB3ScalarSelection(db3.eventStatusEntity, selection)

    expect(compiled.members.map(member => member.member)).toEqual(["id"])
    expect(compiled.dtoSchema.parse({ id: 10, label: "stripped" })).toEqual({ id: 10 })
  })

  it("reports the entity and complete path for unknown selected members", () => {
    expect(() => compileDB3ScalarSelection(db3.eventStatusEntity, {
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

    expect(() => compileDB3ScalarSelection(db3.eventStatusEntity, selection)).toThrow(
      "'EventStatus.select.events': GhostField field 'events' does not declare readTransportSchema",
    )
  })

  it("recognizes normalized foreign keys but defers their relation semantics", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: { statusId: true },
    })

    expect(() => compileDB3ScalarSelection(db3.eventEntity, selection)).toThrow(
      "'Event.select.statusId': ForeignSingleField field 'status' owns this as foreignKey",
    )
  })

  it("rejects nested relation selections until recursive compilation is supported", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      select: {
        status: {
          select: { id: true },
        },
      },
    })

    expect(() => compileDB3ScalarSelection(db3.eventEntity, selection)).toThrow(
      "'Event.select.status': ForeignSingleField field 'status' owns this as foreignObject",
    )
  })

  it("rejects include-only selections explicitly", () => {
    const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
      include: { status: true },
    })

    expect(() => compileDB3ScalarSelection(db3.eventEntity, selection)).toThrow(
      "'Event.include': the scalar compiler supports explicit 'select' selections only",
    )
  })
})
