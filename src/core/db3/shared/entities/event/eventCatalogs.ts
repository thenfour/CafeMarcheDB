import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { EventAttendancePublicId, EventStatusPublicId, EventTypePublicId } from "shared/publicId";
import { gIconOptions } from "shared/utils";
import { gGeneralPaletteList, type ColorPaletteEntry } from "src/core/components/color/palette";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { BoolField, GhostField, MakeColorField, MakeIconField, MakeIntegerField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSignificanceField, MakeSortOrderField } from "../../columnTypes/xTableColumnTypes";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { type DB3CreateFromStringContext, DB3FieldReadAuth, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { EventStatusSignificance, EventTypeSignificance } from "../../schema/prismArgs";

const authMap = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_catalogs,
    PreMutate: Permission.manage_global_catalogs,
    PreMutateAsOwner: Permission.manage_global_catalogs,
});
// Back-reference metadata stays structural until its owning event workflow is migrated.
const relationAuthMap = defineAuthMap({
    PostQuery: Permission.never_grant,
    PostQueryAsOwner: Permission.never_grant,
    PreInsert: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreMutateAsOwner: Permission.never_grant,
});
const catalogPolicy = {
    queryStrategy: "resolved",
    deletePolicy: "softOnly",
    // Retired shared options still label historical responses; pickers omit them by default.
    viewDeletedPermission: Permission.public,
    restorePermission: Permission.manage_global_catalogs,
    tableAuthMap: {
        View: Permission.public,
        ViewOwn: Permission.public,
        Edit: Permission.manage_global_catalogs,
        EditOwn: Permission.manage_global_catalogs,
        Insert: Permission.manage_global_catalogs,
    },
} as const;

// LSMB todo: writeScope needs to move to a view not schema defs
const localizedField = <const TIdentityMember extends string>(columnName: string, stringIdentityMember: TIdentityMember, stringFormat: "PlainText" | "Markdown") =>
    new LocalizedStringField({ columnName, stringIdentityMember, stringFormat, writeScope: "global", authMap });

function commonFields() {
    return makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        description: columnName => localizedField(columnName, "descriptionId", "Markdown"),
        color: () => MakeColorField({ authMap }),
        sortOrder: () => MakeSortOrderField({ authMap }),
        iconName: columnName => MakeIconField(columnName, gIconOptions, { authMap }),
        isDeleted: () => MakeIsDeletedField({ authMap }),
    });
}

// Row information is needed both before string resolution and for the hydrated editor value.
function catalogRowInfo(row: {
    publicId: string;
    name?: unknown;
    buttonCaption?: unknown;
    description?: unknown;
    color: string | ColorPaletteEntry | null;
    iconName?: string | null;
    isActive?: boolean;
}) {
    return {
        pk: row.publicId,
        name: localizedText(row.name ?? row.buttonCaption) ?? "",
        description: `${row.isActive === false ? "(inactive) " : ""}${localizedText(row.description) ?? ""}`,
        color: gGeneralPaletteList.findEntry(row.color),
        iconName: row.iconName ?? null,
        ownerUserId: null,
    };
}

// helper for generating a new object payload
function createCatalogFromName(input: string, context?: DB3CreateFromStringContext) {
    if (!context?.localeTag) {
        throw new Error("A writing locale is required to create an event catalog option.");
    }
    return {
        name: {
            kind: "set",
            stringPublicId: null,
            localeTag: context.localeTag,
            value: input
        },
        description: {
            kind: "set",
            stringPublicId: null,
            localeTag: context.localeTag,
            value: ""
        },
    };
}

export const eventTypeEditorSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        isDeleted: true,
        significance: true
    },
});
export const xEventType = defineTable({
    ...catalogPolicy,
    tableName: "EventType",
    prismaModel: prismaModel<Prisma.EventTypeDelegate>(),
    getIdentity: (row: { publicId: EventTypePublicId }) => row.publicId,
    getSelectionArgs: () => eventTypeEditorSelection,
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getRowInfo: catalogRowInfo,
    createInsertModelFromString: createCatalogFromName,
    fields: {
        ...commonFields(),
        publicId: MakePublicIdField<EventTypePublicId>(),
        name: localizedField("name", "nameId", "PlainText"),
        significance: MakeSignificanceField("significance", EventTypeSignificance, { authMap }),
        events: new GhostField({ memberName: "events", authMap: relationAuthMap }),
    },
});

export const eventStatusEditorSelection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        isDeleted: true,
        significance: true,
    },
});
export const xEventStatus = defineTable({
    ...catalogPolicy, tableName: "EventStatus", prismaModel: prismaModel<Prisma.EventStatusDelegate>(),
    getIdentity: (row: { publicId: EventStatusPublicId }) => row.publicId,
    getSelectionArgs: () => eventStatusEditorSelection,
    naturalOrderBy: { sortOrder: "asc", name: "asc" }, getRowInfo: catalogRowInfo,
    createInsertModelFromString: createCatalogFromName,
    fields: {
        ...commonFields(), publicId: MakePublicIdField<EventStatusPublicId>(),
        name: localizedField("name", "nameId", "PlainText"),
        significance: MakeSignificanceField("significance", EventStatusSignificance, { authMap }),
        events: new GhostField({ memberName: "events", authMap: relationAuthMap }),
        eventSegments: new GhostField({ memberName: "eventSegments", authMap: relationAuthMap }),
    },
});

export const eventAttendanceEditorSelection = Prisma.validator<Prisma.EventAttendanceDefaultArgs>()({
    select: {
        publicId: true,
        buttonCaption: true,
        personalCaption: true,
        pastCaption: true,
        personalPastCaption: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        isDeleted: true,
        strength: true,
        isActive: true,
    },
});

export const xEventAttendance = defineTable({
    ...catalogPolicy,
    tableName: "EventAttendance",
    prismaModel: prismaModel<Prisma.EventAttendanceDelegate>(),
    getIdentity: (row: { publicId: EventAttendancePublicId }) => row.publicId,
    getSelectionArgs: () => eventAttendanceEditorSelection,
    naturalOrderBy: { sortOrder: "asc", buttonCaption: "asc" },
    getRowInfo: catalogRowInfo,
    activeAsSelectable: (row: { isActive: boolean }) => row.isActive,
    fields: {
        ...commonFields(), publicId: MakePublicIdField<EventAttendancePublicId>(),
        buttonCaption: localizedField("buttonCaption", "buttonCaptionId", "PlainText"),
        personalCaption: localizedField("personalCaption", "personalCaptionId", "PlainText"),
        pastCaption: localizedField("pastCaption", "pastCaptionId", "PlainText"),
        personalPastCaption: localizedField("personalPastCaption", "personalPastCaptionId", "PlainText"),
        strength: MakeIntegerField("strength", { authMap }),
        isActive: new BoolField({ columnName: "isActive", defaultValue: true, allowNull: false, authMap }),
        responses: new GhostField({ memberName: "responses", authMap: relationAuthMap }),
    },
});

export const eventTypeContract = deriveViewContract(xEventType, eventTypeEditorSelection);
export const eventStatusContract = deriveViewContract(xEventStatus, eventStatusEditorSelection);
export const eventAttendanceContract = deriveViewContract(xEventAttendance, eventAttendanceEditorSelection);
const eventAttendanceReferenceContract = deriveViewContract(xEventAttendance, Prisma.validator<Prisma.EventAttendanceDefaultArgs>()({
    select: { publicId: true, buttonCaption: true, description: true, color: true, iconName: true },
}));
export const eventAttendanceReferenceView = defineView({
    viewID: "EventAttendance_Reference", entity: xEventAttendance,
    selection: eventAttendanceReferenceContract.prismaSelection,
    dtoSchema: eventAttendanceReferenceContract.dtoSchema,
    hydrate: eventAttendanceReferenceContract.hydrate,
});

export const eventTypeDisplayContract = {
    ...eventTypeContract,
    hydrate: (...args: Parameters<typeof eventTypeContract.hydrate>) => {
        const row = eventTypeContract.hydrate(...args);
        return {
            ...row,
            name: row.name.value ?? "",
            description: row.description.value ?? "",
        };
    },
};
export const eventStatusDisplayContract = {
    ...eventStatusContract,
    hydrate: (...args: Parameters<typeof eventStatusContract.hydrate>) => {
        const row = eventStatusContract.hydrate(...args);
        return {
            ...row,
            name: row.name.value ?? "",
            description: row.description.value ?? "",
        };
    },
};
export const eventAttendanceDisplayContract = {
    ...eventAttendanceContract,
    hydrate: (...args: Parameters<typeof eventAttendanceContract.hydrate>) => {
        const row = eventAttendanceContract.hydrate(...args);
        return {
            ...row,
            buttonCaption: row.buttonCaption.value ?? "",
            personalCaption: row.personalCaption.value ?? "",
            pastCaption: row.pastCaption.value ?? "",
            personalPastCaption: row.personalPastCaption.value ?? "",
            description: row.description.value ?? ""
        };
    },
};

export const eventTypeEditorView = defineCrudView({
    viewID: "EventType_Editor",
    entity: xEventType,
    operations: { create: true, update: true, delete: true },
    selection: eventTypeContract.prismaSelection,
    dtoSchema: eventTypeContract.dtoSchema,
    hydrate: eventTypeContract.hydrate,
});
export const eventStatusEditorView = defineCrudView({
    viewID: "EventStatus_Editor",
    entity: xEventStatus,
    operations: { create: true, update: true, delete: true },
    selection: eventStatusContract.prismaSelection,
    dtoSchema: eventStatusContract.dtoSchema,
    hydrate: eventStatusContract.hydrate,
});
export const eventAttendanceEditorView = defineCrudView({
    viewID: "EventAttendance_Editor",
    entity: xEventAttendance,
    operations: { create: true, update: true, delete: true },
    selection: eventAttendanceContract.prismaSelection,
    dtoSchema: eventAttendanceContract.dtoSchema,
    hydrate: eventAttendanceContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        EventType: typeof xEventType;
        EventStatus: typeof xEventStatus;
        EventAttendance: typeof xEventAttendance;
    }
}
