import { Prisma } from "db"
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

describe("DB3 xTable Prisma model metadata", () => {
  it("derives the default payload and entity delegate from the target table", () => {
    expectTypeOf<db3.DB3PrismaPayloadOf<typeof db3.xEventTag>>()
      .toEqualTypeOf<Prisma.EventTagGetPayload<{}>>()
    expectTypeOf<db3.PrismaDelegateOf<typeof db3.eventTagEntity>>()
      .toEqualTypeOf<Prisma.EventTagDelegate>()
    expectTypeOf(db3.xEventTagAssignment.fields.eventTag).toEqualTypeOf<
      db3.ForeignSingleField<
        Prisma.EventTagGetPayload<{}>,
        typeof db3.xEventTag
      >
    >()
  })

  it("keeps target resolution lazy while deriving the runtime table ID", () => {
    const getTarget = vi.fn(() => db3.xEventTag)
    const field = db3.foreignRef(getTarget, {
      fkidMember: "eventTagId",
      authMap: db3.createAuthContextMap_GrantAll(),
    })("eventTag")

    expect(getTarget).not.toHaveBeenCalled()
    const descriptor = field.getPrismaMemberDescriptors()[0]!
    expect(getTarget).not.toHaveBeenCalled()
    expect(descriptor.kind).toBe("foreignObject")
    if (descriptor.kind !== "foreignObject") throw new Error("expected relation descriptor")
    expect(descriptor.getTargetTable()).toBe(db3.xEventTag)
    expect(field.foreignTableID).toBe("EventTag")
    expect(field.allowNull).toBe(false)
    expect(field.getQuickFilterWhereClause("anything")).toBe(false)
  })

  it("resolves migrated schema relations directly to their target xTable", () => {
    const field = db3.xEventTagAssignment.fields.eventTag

    expect(field.getForeignTableSchema()).toBe(db3.xEventTag)
    expect(field.foreignTableID).toBe(db3.xEventTag.tableID)
    expect(db3.xWikiPage.fields.currentRevision.getForeignTableSchema())
      .toBe(db3.xWikiPageRevision)
    expect(db3.xWikiPageRevision.fields.wikiPage.getForeignTableSchema())
      .toBe(db3.xWikiPage)
  })
})

describe("DB3 scalar field read contracts", () => {
  it("retains nullability and authorization presence in field types", () => {
    type RequiredNonNull = db3.DB3ReadFieldProperty<
      "label",
      typeof db3.xEventStatus.fields.label
    >
    type RequiredNullable = db3.DB3ReadFieldProperty<
      "iconName",
      typeof db3.xEventStatus.fields.iconName
    >

    const permissionControlled = new db3.GenericStringField({
      columnName: "value",
      allowNull: false,
      format: "plain",
      authMap: db3.createAuthContextMap_GrantAll(),
    })
    type OptionalNonNull = db3.DB3ReadFieldProperty<
      "value",
      typeof permissionControlled
    >
    const mixedOwnerPolicy = new db3.GenericStringField({
      columnName: "mixed",
      allowNull: false,
      format: "plain",
      authMap: {
        PostQuery: db3.DB3FieldReadAuth.inheritRow,
        PostQueryAsOwner: Permission.always_grant,
        PreInsert: Permission.never_grant,
        PreMutate: Permission.never_grant,
        PreMutateAsOwner: Permission.never_grant,
      },
    })
    type MixedPolicyOptional = db3.DB3ReadFieldProperty<
      "mixed",
      typeof mixedOwnerPolicy
    >

    expectTypeOf<RequiredNonNull>().toEqualTypeOf<{ label: string }>()
    expectTypeOf<RequiredNullable>().toEqualTypeOf<{ iconName: string | null }>()
    expectTypeOf<OptionalNonNull>().toEqualTypeOf<{ value?: string }>()
    expectTypeOf<MixedPolicyOptional>().toEqualTypeOf<{ mixed?: string }>()
    expectTypeOf(db3.xEventStatus.fields.label.parseReadTransportValue("Visible"))
      .toEqualTypeOf<string>()
    expectTypeOf(db3.xEventStatus.fields.iconName.parseReadTransportValue(null))
      .toEqualTypeOf<string | null>()
  })

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
    expectTypeOf(duration).toEqualTypeOf<bigint>()
    expect(duration).toBe(durationValue)
    expect(db3.xEvent.fields.durationMillis.readTransportSchema!
      .safeParse(60_000).success).toBe(false)
    expect(db3.xEventSegment.fields.durationMillis.readTransportSchema!
      .safeParse(durationValue).success).toBe(true)

    const sortOrder = db3.xEventStatus.fields.sortOrder.parseReadTransportValue(1)
    expectTypeOf(sortOrder).toEqualTypeOf<number>()
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

describe("DB3 Prisma-member ownership", () => {
  it("registers ordinary scalar members against their field contracts", () => {
    const ownership = db3.xEventStatus.resolvePrismaMember("label")

    expect(ownership).toMatchObject({
      member: "label",
      kind: "field",
      field: db3.xEventStatus.fields.label,
    })
    expect(db3.xEventStatus.prismaMemberRegistry.get("label")).toBe(ownership)
  })

  it("registers both the relation object and scalar key for foreign-single fields", () => {
    const relation = db3.xEvent.resolvePrismaMember("status")
    const foreignKey = db3.xEvent.resolvePrismaMember("statusId")

    expect(relation).toMatchObject({ member: "status", kind: "foreignObject" })
    expect(foreignKey).toMatchObject({ member: "statusId", kind: "foreignKey" })
    expect(relation.field).toBe(db3.xEvent.fields.status)
    expect(foreignKey.field).toBe(db3.xEvent.fields.status)
  })

  it("reports the table and full selection path for unknown members", () => {
    expect(() => db3.xEvent.resolvePrismaMember("missing", "event.status.missing"))
      .toThrow("DB3 table 'Event' does not own selected Prisma member 'event.status.missing' (member 'missing')")
  })

  it("rejects ambiguous member ownership while constructing the table", () => {
    const authMap = db3.createAuthContextMap_GrantAll()

    expect(() => new db3.xTable({
      tableName: "DuplicatePrismaMemberFixture",
      deletePolicy: "hard",
      tableAuthMap: {
        ViewOwn: Permission.always_grant,
        View: Permission.always_grant,
        EditOwn: Permission.always_grant,
        Edit: Permission.always_grant,
        Insert: Permission.always_grant,
      },
      getSelectionArgs: () => ({}),
      getRowInfo: row => ({
        pk: row.id,
        name: String(row.id),
        ownerUserId: null,
      }),
      columns: [
        db3.MakePKfield(),
        new db3.ForeignSingleField({
          columnName: "status",
          fkidMember: "statusId",
          foreignTableID: "EventStatus",
          allowNull: true,
          authMap,
          getQuickFilterWhereClause: () => false,
        }),
        db3.MakeIntegerField("statusId", { authMap }),
      ],
    })).toThrow(
      "DB3 table 'DuplicatePrismaMemberFixture' has ambiguous Prisma member 'statusId': "
      + "fields 'status' (foreignKey) and 'statusId' (field) both claim it",
    )
  })
})
