import { describe, expect, expectTypeOf, it, vi } from "vitest"

import type { ColorPaletteEntry } from "src/core/components/color/palette"
import * as db3 from "src/core/db3/db3"
import { Permission } from "shared/permissions"

const eventStatusTransport = {
  id: 10,
  isDeleted: false,
  label: "Confirmed",
  description: "Public display metadata",
  sortOrder: 1,
  color: "green",
  significance: db3.EventStatusSignificance.FinalConfirmation,
  iconName: null,
}

const eventStatusScalarMembers = Object.keys(eventStatusTransport) as Array<
  keyof typeof eventStatusTransport
>

describe("DB3 scalar field read contracts", () => {
  it("validates present EventStatus transport values without adding authorization optionality", () => {
    for (const member of eventStatusScalarMembers) {
      const field = db3.xEventStatus.getColumn(member) as db3.AnyDB3Field
      const schema = field.getReadTransportSchema()

      expect(schema.parse(eventStatusTransport[member])).toEqual(eventStatusTransport[member])
      expect(schema.safeParse(undefined).success).toBe(false)
      expect(field.isReadRequiredAfterRowAuth()).toBe(true)
    }
  })

  it("keeps database nullability and primitive validation in the field schema", () => {
    expect(db3.xEventStatus.fields.color.parseReadTransportValue(null)).toBeNull()
    expect(db3.xEventStatus.fields.significance.parseReadTransportValue(null)).toBeNull()
    expect(db3.xEventStatus.fields.iconName.parseReadTransportValue(null)).toBeNull()

    expect(db3.xEventStatus.fields.label.readTransportSchema!.safeParse(null).success).toBe(false)
    expect(db3.xEventStatus.fields.id.readTransportSchema!.safeParse(1.5).success).toBe(false)
    expect(db3.xEventStatus.fields.sortOrder.readTransportSchema!.safeParse(1.5).success).toBe(false)
    expect(db3.xEventStatus.fields.isDeleted.readTransportSchema!.safeParse("false").success)
      .toBe(false)
    expect(db3.xEventStatus.fields.significance.readTransportSchema!
      .safeParse("not-a-significance").success).toBe(false)
  })

  it("hydrates valid scalar values consistently with the legacy client-model path", () => {
    const legacyClient = db3.xEventStatus.getClientModel(eventStatusTransport, "view")

    for (const member of eventStatusScalarMembers) {
      const field = db3.xEventStatus.getColumn(member) as db3.AnyDB3Field
      expect(field.parseAndHydrateReadTransportValue(eventStatusTransport[member]))
        .toEqual(legacyClient[member])
    }

    const hydratedColor = db3.xEventStatus.fields.color
      .parseAndHydrateReadTransportValue("green")
    expectTypeOf(hydratedColor).toEqualTypeOf<ColorPaletteEntry | null>()
    expect(hydratedColor?.id).toBe("green")
  })

  it("uses the boolean codec for the existing null-to-default consumer conversion", () => {
    const field = new db3.BoolField({
      columnName: "flag",
      allowNull: true,
      defaultValue: false,
      authMap: db3.createAuthContextMap_GrantAll(),
    })
    const decode = vi.spyOn(field.codec, "decode")

    expect(field.parseReadTransportValue(null)).toBeNull()
    expect(field.parseAndHydrateReadTransportValue(null)).toBe(false)
    expect(decode).toHaveBeenCalledTimes(1)

    const legacyClient = {}
    field.ApplyDbToClient({ flag: null }, legacyClient, "view")
    expect(legacyClient).toEqual({ flag: false })
  })

  it("describes Prisma BigInt fields separately from ordinary integers", () => {
    const durationValue = BigInt(60_000)
    const duration = db3.xEvent.fields.durationMillis.parseReadTransportValue(durationValue)
    expectTypeOf(duration).toEqualTypeOf<bigint | null>()
    expect(duration).toBe(durationValue)
    expect(db3.xEvent.fields.durationMillis.readTransportSchema!
      .safeParse(60_000).success).toBe(false)
    expect(db3.xEventSegment.fields.durationMillis.readTransportSchema!
      .safeParse(durationValue).success).toBe(true)

    const sortOrder = db3.xEventStatus.fields.sortOrder.parseReadTransportValue(1)
    expectTypeOf(sortOrder).toEqualTypeOf<number | null>()
    expect(sortOrder).toBe(1)
  })

  it("covers dates, revisions, and public IDs as scalar transports", () => {
    const now = new Date("2026-09-22T12:00:00.000Z")
    expect(db3.xEvent.fields.createdAt.parseReadTransportValue(now)).toEqual(now)
    expect(db3.xEvent.fields.startsAt.parseReadTransportValue(null)).toBeNull()
    expect(db3.xEvent.fields.revision.parseReadTransportValue(3)).toBe(3)
    expect(db3.xInstrumentFunctionalGroup.fields.publicId
      .parseReadTransportValue("abcdefghijklmnop")).toBe("abcdefghijklmnop")
    expect(db3.xInstrumentFunctionalGroup.fields.publicId.readTransportSchema!
      .safeParse("too-short").success).toBe(false)
  })

  it("rejects malformed non-null values instead of applying legacy coercion", () => {
    expect(db3.xEventStatus.fields.isDeleted.readTransportSchema!.safeParse(null).success)
      .toBe(false)

    const legacyClient = db3.xEventStatus.getClientModel({ isDeleted: null }, "view")
    expect(legacyClient.isDeleted).toBe(false)
  })

  it("leaves relation fields unsupported until they declare a read contract", () => {
    expect(db3.xEvent.fields.status.readTransportSchema).toBeUndefined()
    expect(() => db3.xEvent.fields.status.getReadTransportSchema())
      .toThrow("field 'status' does not declare readTransportSchema")
  })

  it("keeps the read contract independent from write authorization", () => {
    expect(db3.xEventStatus.fields.label.authMap?.PreMutate).toBe(Permission.manage_events)
    expect(db3.xEventStatus.fields.label.getReadTransportSchema().parse("Visible")).toBe("Visible")
  })
})
