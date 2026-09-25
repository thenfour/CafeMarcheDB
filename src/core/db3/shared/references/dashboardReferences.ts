// one could argue "why is dashboard stuff in db3"?
// but db3 has basically 2 layers: the core ORM-like layer, and an application-specific
// layer that understands the CMDB schema.

import { Prisma } from "db";
import {
    DB3ReferenceStore,
    defineReferenceContract,
    reference,
} from "../core/db3Hydration";
import { type ClientOf, defineView } from "../core/db3View";
import { deriveViewContract } from "../core/db3ViewContract";
import {
    xEventAttendance,
    xEventStatus,
    xEventTag,
    xEventType,
} from "../schema/event";
import {
    xFileTag,
} from "../schema/file";
import {
    xInstrument,
    xInstrumentFunctionalGroup,
    xInstrumentTag,
} from "../schema/instrument";
import { PermissionForVisibilityArgs } from "../schema/prismArgs";
import {
    xSongCreditType,
    xSongTag,
} from "../schema/song";
import { xPermission, xRole, xUserTag } from "../schema/user";
import { xWikiPageTag } from "../schema/wikiPageTag";

// dashboard provider provides "hydrated" objects, not raw db rows
// (e.g. ColorPaletteEntry rather than `string`).
// use the actual db3 view mechanism to do this;  it means prisma select -> dto schema -> hydration with xTable column metadata


const dashboardEventTypeSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
    select: {
        publicId: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        text: true,
        significance: true,
    },
});

const dashboardUserTagSelection = Prisma.validator<Prisma.UserTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        significance: true,
        sortOrder: true,
        cssClass: true,
    },
});

const dashboardRoleSelection = Prisma.validator<Prisma.RoleDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        isRoleForNewUsers: true,
        isPublicRole: true,
        isSysAdminRole: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
    },
});

const dashboardWikiPageTagSelection = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        significance: true,
        sortOrder: true,
    },
});

const dashboardEventStatusSelection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
    select: {
        publicId: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        label: true,
        significance: true,
    },
});

const dashboardEventTagSelection = Prisma.validator<Prisma.EventTagDefaultArgs>()({
    select: {
        publicId: true,
        description: true,
        color: true,
        sortOrder: true,
        text: true,
        significance: true,
        visibleOnFrontpage: true,
    },
});

const dashboardEventAttendanceSelection = Prisma.validator<Prisma.EventAttendanceDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        iconName: true,
        color: true,
        sortOrder: true,
        isDeleted: true,
        strength: true,
        personalText: true,
        pastText: true,
        pastPersonalText: true,
        isActive: true,
    },
});

const dashboardFileTagSelection = Prisma.validator<Prisma.FileTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const dashboardInstrumentFunctionalGroupSelection = Prisma.validator<
    Prisma.InstrumentFunctionalGroupDefaultArgs
>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        sortOrder: true,
        color: true,
    },
});

const dashboardInstrumentTagSelection = Prisma.validator<Prisma.InstrumentTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
    },
});

const dashboardSongTagSelection = Prisma.validator<Prisma.SongTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
        indicator: true,
        indicatorCssClass: true,
        group: true,
    },
});

const dashboardSongCreditTypeSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const dashboardInstrumentTransportSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        autoAssignFileLeafRegex: true,
        sortOrder: true,
        functionalGroupId: true,
        instrumentTags: {
            select: {
                publicId: true,
                tagId: true,
            },
        },
    },
});

// These projections and conversions are private details of the dashboard
// provider. DB3 views see only dashboardReferenceContract's per-entity output
// types; another provider may construct completely different values.
export const dashboardPermissionResource = deriveViewContract(
    xPermission,
    PermissionForVisibilityArgs,
);
export const dashboardUserTagResource = deriveViewContract(
    xUserTag,
    dashboardUserTagSelection,
);
export const dashboardRoleResource = deriveViewContract(
    xRole,
    dashboardRoleSelection,
);
export const dashboardWikiPageTagResource = deriveViewContract(
    xWikiPageTag,
    dashboardWikiPageTagSelection,
);
export const dashboardEventTypeResource = deriveViewContract(
    xEventType,
    dashboardEventTypeSelection,
);
export const dashboardEventStatusResource = deriveViewContract(
    xEventStatus,
    dashboardEventStatusSelection,
);
export const dashboardEventTagResource = deriveViewContract(
    xEventTag,
    dashboardEventTagSelection,
);
export const dashboardEventAttendanceResource = deriveViewContract(
    xEventAttendance,
    dashboardEventAttendanceSelection,
);
export const dashboardFileTagResource = deriveViewContract(
    xFileTag,
    dashboardFileTagSelection,
);
export const dashboardInstrumentFunctionalGroupResource = deriveViewContract(
    xInstrumentFunctionalGroup,
    dashboardInstrumentFunctionalGroupSelection,
);
export const dashboardInstrumentTagResource = deriveViewContract(
    xInstrumentTag,
    dashboardInstrumentTagSelection,
);
export const dashboardSongTagResource = deriveViewContract(
    xSongTag,
    dashboardSongTagSelection,
);
export const dashboardSongCreditTypeResource = deriveViewContract(
    xSongCreditType,
    dashboardSongCreditTypeSelection,
);

export const dashboardLeafReferenceContract = defineReferenceContract({
    permission: reference(xPermission)<ReturnType<typeof dashboardPermissionResource.hydrate>>(),
    wikiPageTag: reference(xWikiPageTag)<CompleteWikiPageTagDashboardClient>(),
    eventType: reference(xEventType)<ReturnType<typeof dashboardEventTypeResource.hydrate>>(),
    eventStatus: reference(xEventStatus)<ReturnType<typeof dashboardEventStatusResource.hydrate>>(),
    eventTag: reference(xEventTag)<ReturnType<typeof dashboardEventTagResource.hydrate>>(),
    eventAttendance: reference(xEventAttendance)<ReturnType<typeof dashboardEventAttendanceResource.hydrate>>(),
    fileTag: reference(xFileTag)<ReturnType<typeof dashboardFileTagResource.hydrate>>(),
    instrumentFunctionalGroup: reference(xInstrumentFunctionalGroup)<
        ReturnType<typeof dashboardInstrumentFunctionalGroupResource.hydrate>
    >(),
    instrumentTag: reference(xInstrumentTag)<ReturnType<typeof dashboardInstrumentTagResource.hydrate>>(),
    songTag: reference(xSongTag)<ReturnType<typeof dashboardSongTagResource.hydrate>>(),
    songCreditType: reference(xSongCreditType)<ReturnType<typeof dashboardSongCreditTypeResource.hydrate>>(),
});

export const dashboardInstrumentResource = deriveViewContract(
    xInstrument,
    dashboardInstrumentTransportSelection,
    {
        references: dashboardLeafReferenceContract,
    },
);

export const dashboardReferenceContract = defineReferenceContract({
    ...dashboardLeafReferenceContract.definitions,
    instrument: reference(xInstrument)<ReturnType<typeof dashboardInstrumentResource.hydrate>>(),
});

export const permissionDashboardView = defineView({
    viewID: "Permission_Dashboard",
    entity: xPermission,
    selection: dashboardPermissionResource.prismaSelection,
    dtoSchema: dashboardPermissionResource.dtoSchema,
    references: dashboardPermissionResource.referenceContract,
    hydrate: dashboardPermissionResource.hydrate,
});

export const userTagDashboardView = defineView({
    viewID: "UserTag_Dashboard",
    entity: xUserTag,
    selection: dashboardUserTagResource.prismaSelection,
    dtoSchema: dashboardUserTagResource.dtoSchema,
    references: dashboardUserTagResource.referenceContract,
    hydrate: dashboardUserTagResource.hydrate,
});

export const roleDashboardView = defineView({
    viewID: "Role_Dashboard",
    entity: xRole,
    selection: dashboardRoleResource.prismaSelection,
    dtoSchema: dashboardRoleResource.dtoSchema,
    references: dashboardRoleResource.referenceContract,
    hydrate: dashboardRoleResource.hydrate,
});

export const wikiPageTagDashboardView = defineView({
    viewID: "WikiPageTag_Dashboard",
    entity: xWikiPageTag,
    selection: dashboardWikiPageTagResource.prismaSelection,
    dtoSchema: dashboardWikiPageTagResource.dtoSchema,
    references: dashboardWikiPageTagResource.referenceContract,
    hydrate: dashboardWikiPageTagResource.hydrate,
});

export const eventTypeDashboardView = defineView({
    viewID: "EventType_Dashboard",
    entity: xEventType,
    selection: dashboardEventTypeResource.prismaSelection,
    dtoSchema: dashboardEventTypeResource.dtoSchema,
    references: dashboardEventTypeResource.referenceContract,
    hydrate: dashboardEventTypeResource.hydrate,
});

export const eventStatusDashboardView = defineView({
    viewID: "EventStatus_Dashboard",
    entity: xEventStatus,
    selection: dashboardEventStatusResource.prismaSelection,
    dtoSchema: dashboardEventStatusResource.dtoSchema,
    references: dashboardEventStatusResource.referenceContract,
    hydrate: dashboardEventStatusResource.hydrate,
});

export const eventTagDashboardView = defineView({
    viewID: "EventTag_Dashboard",
    entity: xEventTag,
    selection: dashboardEventTagResource.prismaSelection,
    dtoSchema: dashboardEventTagResource.dtoSchema,
    references: dashboardEventTagResource.referenceContract,
    hydrate: dashboardEventTagResource.hydrate,
});

export const eventAttendanceDashboardView = defineView({
    viewID: "EventAttendance_Dashboard",
    entity: xEventAttendance,
    selection: dashboardEventAttendanceResource.prismaSelection,
    dtoSchema: dashboardEventAttendanceResource.dtoSchema,
    references: dashboardEventAttendanceResource.referenceContract,
    hydrate: dashboardEventAttendanceResource.hydrate,
});

export const fileTagDashboardView = defineView({
    viewID: "FileTag_Dashboard",
    entity: xFileTag,
    selection: dashboardFileTagResource.prismaSelection,
    dtoSchema: dashboardFileTagResource.dtoSchema,
    references: dashboardFileTagResource.referenceContract,
    hydrate: dashboardFileTagResource.hydrate,
});

export const instrumentFunctionalGroupDashboardView = defineView({
    viewID: "InstrumentFunctionalGroup_Dashboard",
    entity: xInstrumentFunctionalGroup,
    selection: dashboardInstrumentFunctionalGroupResource.prismaSelection,
    dtoSchema: dashboardInstrumentFunctionalGroupResource.dtoSchema,
    references: dashboardInstrumentFunctionalGroupResource.referenceContract,
    hydrate: dashboardInstrumentFunctionalGroupResource.hydrate,
});

export const instrumentTagDashboardView = defineView({
    viewID: "InstrumentTag_Dashboard",
    entity: xInstrumentTag,
    selection: dashboardInstrumentTagResource.prismaSelection,
    dtoSchema: dashboardInstrumentTagResource.dtoSchema,
    references: dashboardInstrumentTagResource.referenceContract,
    hydrate: dashboardInstrumentTagResource.hydrate,
});

export const songTagDashboardView = defineView({
    viewID: "SongTag_Dashboard",
    entity: xSongTag,
    selection: dashboardSongTagResource.prismaSelection,
    dtoSchema: dashboardSongTagResource.dtoSchema,
    references: dashboardSongTagResource.referenceContract,
    hydrate: dashboardSongTagResource.hydrate,
});

export const songCreditTypeDashboardView = defineView({
    viewID: "SongCreditType_Dashboard",
    entity: xSongCreditType,
    selection: dashboardSongCreditTypeResource.prismaSelection,
    dtoSchema: dashboardSongCreditTypeResource.dtoSchema,
    references: dashboardSongCreditTypeResource.referenceContract,
    hydrate: dashboardSongCreditTypeResource.hydrate,
});

export const instrumentDashboardView = defineView({
    viewID: "Instrument_Dashboard",
    entity: xInstrument,
    selection: dashboardInstrumentResource.prismaSelection,
    dtoSchema: dashboardInstrumentResource.dtoSchema,
    references: dashboardInstrumentResource.referenceContract,
    hydrate: (dto, references) => {
        const hydrated = dashboardInstrumentResource.hydrate(dto, references);
        return {
            ...hydrated,
            instrumentTags: [...hydrated.instrumentTags]
                .sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),
        };
    },
});

export type PermissionDashboardClient = ClientOf<typeof permissionDashboardView>;
export type UserTagDashboardClient = ClientOf<typeof userTagDashboardView>;
export type UserTagDisplay = UserTagDashboardClient;
export type RoleDashboardClient = ClientOf<typeof roleDashboardView>;
export type CompleteRoleDashboardClient = {
    [TKey in keyof RoleDashboardClient]-?: Exclude<RoleDashboardClient[TKey], undefined>;
};
export type RoleDisplay = CompleteRoleDashboardClient;
export type WikiPageTagDashboardClient = ClientOf<typeof wikiPageTagDashboardView>;
export type CompleteWikiPageTagDashboardClient = {
    [TKey in keyof WikiPageTagDashboardClient]-?: Exclude<
        WikiPageTagDashboardClient[TKey],
        undefined
    >;
};
export type WikiPageTagDisplay =
    CompleteWikiPageTagDashboardClient;
export type EventTypeDashboardClient = ClientOf<typeof eventTypeDashboardView>;
export type EventStatusDashboardClient = ClientOf<typeof eventStatusDashboardView>;
export type EventTagDashboardClient = ClientOf<typeof eventTagDashboardView>;
export type EventAttendanceDashboardClient = ClientOf<typeof eventAttendanceDashboardView>;
export type CompleteEventAttendanceDashboardClient = {
    [TKey in keyof EventAttendanceDashboardClient]-?: Exclude<
        EventAttendanceDashboardClient[TKey],
        undefined
    >;
};
export type EventAttendanceDisplay = CompleteEventAttendanceDashboardClient;
export type FileTagDashboardClient = ClientOf<typeof fileTagDashboardView>;
export type InstrumentFunctionalGroupDashboardClient = ClientOf<
    typeof instrumentFunctionalGroupDashboardView
>;
export type InstrumentTagDashboardClient = ClientOf<typeof instrumentTagDashboardView>;
export type SongTagDashboardClient = ClientOf<typeof songTagDashboardView>;
export type SongCreditTypeDashboardClient = ClientOf<typeof songCreditTypeDashboardView>;

export function isCompleteEventAttendanceDashboardClient(
    value: EventAttendanceDashboardClient,
): value is CompleteEventAttendanceDashboardClient {
    return value.text !== undefined
        && value.description !== undefined
        && value.iconName !== undefined
        && value.color !== undefined
        && value.sortOrder !== undefined
        && value.isDeleted !== undefined
        && value.strength !== undefined
        && value.personalText !== undefined
        && value.pastText !== undefined
        && value.pastPersonalText !== undefined
        && value.isActive !== undefined;
}

export function isCompleteRoleDashboardClient(
    value: RoleDashboardClient,
): value is CompleteRoleDashboardClient {
    return value.name !== undefined
        && value.isRoleForNewUsers !== undefined
        && value.isPublicRole !== undefined
        && value.isSysAdminRole !== undefined
        && value.description !== undefined
        && value.sortOrder !== undefined
        && value.color !== undefined
        && value.significance !== undefined;
}

export function isCompleteWikiPageTagDashboardClient(
    value: WikiPageTagDashboardClient,
): value is CompleteWikiPageTagDashboardClient {
    return value.text !== undefined
        && value.description !== undefined
        && value.color !== undefined
        && value.significance !== undefined
        && value.sortOrder !== undefined;
}

export type DashboardReferenceContract = typeof dashboardReferenceContract;
export type DashboardReferenceStore = DB3ReferenceStore<DashboardReferenceContract>;

export interface DashboardReferenceInput {
    permission?: readonly ClientOf<typeof permissionDashboardView>[];
    wikiPageTag?: readonly CompleteWikiPageTagDashboardClient[];
    eventType?: readonly ClientOf<typeof eventTypeDashboardView>[];
    eventStatus?: readonly ClientOf<typeof eventStatusDashboardView>[];
    eventTag?: readonly ClientOf<typeof eventTagDashboardView>[];
    eventAttendance?: readonly ClientOf<typeof eventAttendanceDashboardView>[];
    fileTag?: readonly ClientOf<typeof fileTagDashboardView>[];
    instrumentFunctionalGroup?: readonly ClientOf<typeof instrumentFunctionalGroupDashboardView>[];
    instrumentTag?: readonly ClientOf<typeof instrumentTagDashboardView>[];
    songTag?: readonly ClientOf<typeof songTagDashboardView>[];
    songCreditType?: readonly ClientOf<typeof songCreditTypeDashboardView>[];
    instrument?: readonly ClientOf<typeof instrumentDashboardView>[];
}

export function createDashboardReferenceStore(): DashboardReferenceStore {
    return new DB3ReferenceStore(dashboardReferenceContract);
}

/** Registers values that have already been validated and hydrated by their views. */
export function registerDashboardReferences(
    store: DashboardReferenceStore,
    input: DashboardReferenceInput,
): void {
    if (input.permission) {
        store.register(xPermission, input.permission);
    }
    if (input.wikiPageTag) {
        store.register(xWikiPageTag, input.wikiPageTag);
    }
    if (input.eventType) {
        store.register(xEventType, input.eventType);
    }
    if (input.eventStatus) {
        store.register(xEventStatus, input.eventStatus);
    }
    if (input.eventTag) {
        store.register(xEventTag, input.eventTag);
    }
    if (input.eventAttendance) {
        store.register(xEventAttendance, input.eventAttendance);
    }
    if (input.fileTag) {
        store.register(xFileTag, input.fileTag);
    }
    if (input.instrumentFunctionalGroup) {
        store.register(
            xInstrumentFunctionalGroup,
            input.instrumentFunctionalGroup,
        );
    }
    if (input.instrumentTag) {
        store.register(xInstrumentTag, input.instrumentTag);
    }
    if (input.songTag) {
        store.register(xSongTag, input.songTag);
    }
    if (input.songCreditType) {
        store.register(xSongCreditType, input.songCreditType);
    }
    if (input.instrument) {
        store.register(xInstrument, input.instrument);
    }
}
