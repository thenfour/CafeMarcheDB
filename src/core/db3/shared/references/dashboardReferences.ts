import { xBandEventTag, bandEventTagDisplayContract } from "../entities/event/eventTagCatalogs";
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
    xEventType,
} from "../schema/event";
import {
    xFileTag,
} from "../schema/file";
import {
    xBandInstrument,
    xBandInstrumentFunctionalGroup,
    bandInstrumentGroupDisplayContract,
    bandInstrumentDisplayContract,
} from "../entities/instrument/bandInstrumentContracts";
import { permissionDisplayContract } from "../entities/user/permissionViews";
import {
    xSongCreditType,
} from "../schema/song";
import { xBandSongTag, bandSongTagDisplayContract } from "../entities/song/bandSongTagViews";
import { xPermission } from "../schema/user";
import { xBandUserTag, bandUserTagDisplayContract } from "../entities/user/bandUserTagViews";
import { xWikiPageTag } from "../schema/wikiPageTag";

import { eventTypeDisplayContract, eventStatusDisplayContract, eventAttendanceDisplayContract } from "../entities/event/eventCatalogs";

// dashboard provider provides "hydrated" objects, not raw db rows
// (e.g. ColorPaletteEntry rather than `string`).
// use the actual db3 view mechanism to do this;  it means prisma select -> dto schema -> hydration with xTable column metadata


const dashboardWikiPageTagSelection = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
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

const dashboardSongCreditTypeSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
    },
});

// These projections and conversions are private details of the dashboard
// provider. DB3 views see only dashboardReferenceContract's per-entity output
// types; another provider may construct completely different values.
export const dashboardPermissionResource = permissionDisplayContract;
export const dashboardUserTagResource = bandUserTagDisplayContract;
export const dashboardWikiPageTagResource = deriveViewContract(
    xWikiPageTag,
    dashboardWikiPageTagSelection,
);
export const dashboardEventTypeResource = eventTypeDisplayContract;
export const dashboardEventStatusResource = eventStatusDisplayContract;
export const dashboardEventTagResource = bandEventTagDisplayContract;
export const dashboardEventAttendanceResource = eventAttendanceDisplayContract;
export const dashboardFileTagResource = deriveViewContract(
    xFileTag,
    dashboardFileTagSelection,
);
export const dashboardInstrumentFunctionalGroupResource = bandInstrumentGroupDisplayContract;
export const dashboardSongTagResource = bandSongTagDisplayContract;
export const dashboardSongCreditTypeResource = deriveViewContract(
    xSongCreditType,
    dashboardSongCreditTypeSelection,
);

export const dashboardLeafReferenceContract = defineReferenceContract({
    userTag: reference(xBandUserTag)<ReturnType<typeof dashboardUserTagResource.hydrate>>(),
    permission: reference(xPermission)<ReturnType<typeof dashboardPermissionResource.hydrate>>(),
    wikiPageTag: reference(xWikiPageTag)<CompleteWikiPageTagDashboardClient>(),
    eventType: reference(xEventType)<ReturnType<typeof dashboardEventTypeResource.hydrate>>(),
    eventStatus: reference(xEventStatus)<ReturnType<typeof dashboardEventStatusResource.hydrate>>(),
    eventTag: reference(xBandEventTag)<ReturnType<typeof dashboardEventTagResource.hydrate>>(),
    eventAttendance: reference(xEventAttendance)<ReturnType<typeof dashboardEventAttendanceResource.hydrate>>(),
    fileTag: reference(xFileTag)<ReturnType<typeof dashboardFileTagResource.hydrate>>(),
    instrumentFunctionalGroup: reference(xBandInstrumentFunctionalGroup)<
        ReturnType<typeof dashboardInstrumentFunctionalGroupResource.hydrate>
    >(),
    songTag: reference(xBandSongTag)<ReturnType<typeof dashboardSongTagResource.hydrate>>(),
    songCreditType: reference(xSongCreditType)<ReturnType<typeof dashboardSongCreditTypeResource.hydrate>>(),
});

export const dashboardInstrumentResource = bandInstrumentDisplayContract;

export const dashboardReferenceContract = defineReferenceContract({
    ...dashboardLeafReferenceContract.definitions,
    instrument: reference(xBandInstrument)<ReturnType<typeof dashboardInstrumentResource.hydrate>>(),
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
    viewID: "BandUserTag_Dashboard",
    entity: xBandUserTag,
    selection: dashboardUserTagResource.prismaSelection,
    dtoSchema: dashboardUserTagResource.dtoSchema,
    references: dashboardUserTagResource.referenceContract,
    hydrate: dashboardUserTagResource.hydrate,
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
    viewID: "BandEventTag_Dashboard",
    entity: xBandEventTag,
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
    entity: xBandInstrumentFunctionalGroup,
    selection: dashboardInstrumentFunctionalGroupResource.prismaSelection,
    dtoSchema: dashboardInstrumentFunctionalGroupResource.dtoSchema,
    references: dashboardInstrumentFunctionalGroupResource.referenceContract,
    hydrate: dashboardInstrumentFunctionalGroupResource.hydrate,
});

export const songTagDashboardView = defineView({
    viewID: "SongTag_Dashboard",
    entity: xBandSongTag,
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
    entity: xBandInstrument,
    selection: dashboardInstrumentResource.prismaSelection,
    dtoSchema: dashboardInstrumentResource.dtoSchema,
    references: dashboardInstrumentResource.referenceContract,
    hydrate: dashboardInstrumentResource.hydrate,
});

export type PermissionDashboardClient = ClientOf<typeof permissionDashboardView>;
export type UserTagDashboardClient = ClientOf<typeof userTagDashboardView>;
export type UserTagDisplay = UserTagDashboardClient;
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
export type EventAttendanceDisplay = Pick<CompleteEventAttendanceDashboardClient,
    "publicId"
    | "buttonCaption"
    | "personalCaption"
    | "pastCaption"
    | "personalPastCaption"
    | "description"
    | "color"
    | "iconName"
    | "sortOrder"
    | "isDeleted"
    | "strength"
    | "isActive"
>;
export type FileTagDashboardClient = ClientOf<typeof fileTagDashboardView>;
export type InstrumentFunctionalGroupDashboardClient = ClientOf<
    typeof instrumentFunctionalGroupDashboardView
>;
export type SongTagDashboardClient = ClientOf<typeof songTagDashboardView>;
export type SongCreditTypeDashboardClient = ClientOf<typeof songCreditTypeDashboardView>;

export function isCompleteEventAttendanceDashboardClient(
    value: EventAttendanceDashboardClient,
): value is CompleteEventAttendanceDashboardClient {
    return value.buttonCaption !== undefined
        && value.description !== undefined
        && value.iconName !== undefined
        && value.color !== undefined
        && value.sortOrder !== undefined
        && value.isDeleted !== undefined
        && value.strength !== undefined
        && value.personalCaption !== undefined
        && value.pastCaption !== undefined
        && value.personalPastCaption !== undefined
        && value.isActive !== undefined;
}

export function isCompleteWikiPageTagDashboardClient(
    value: WikiPageTagDashboardClient,
): value is CompleteWikiPageTagDashboardClient {
    return value.text !== undefined
        && value.description !== undefined
        && value.color !== undefined
        && value.sortOrder !== undefined;
}

export type DashboardReferenceContract = typeof dashboardReferenceContract;
export type DashboardReferenceStore = DB3ReferenceStore<DashboardReferenceContract>;

export interface DashboardReferenceInput {
    userTag?: readonly ClientOf<typeof userTagDashboardView>[];
    permission?: readonly ClientOf<typeof permissionDashboardView>[];
    wikiPageTag?: readonly CompleteWikiPageTagDashboardClient[];
    eventType?: readonly ClientOf<typeof eventTypeDashboardView>[];
    eventStatus?: readonly ClientOf<typeof eventStatusDashboardView>[];
    eventTag?: readonly ClientOf<typeof eventTagDashboardView>[];
    eventAttendance?: readonly ClientOf<typeof eventAttendanceDashboardView>[];
    fileTag?: readonly ClientOf<typeof fileTagDashboardView>[];
    instrumentFunctionalGroup?: readonly ClientOf<typeof instrumentFunctionalGroupDashboardView>[];
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
    if (input.userTag) {
        store.register(xBandUserTag, input.userTag);
    }
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
        store.register(xBandEventTag, input.eventTag);
    }
    if (input.eventAttendance) {
        store.register(xEventAttendance, input.eventAttendance);
    }
    if (input.fileTag) {
        store.register(xFileTag, input.fileTag);
    }
    if (input.instrumentFunctionalGroup) {
        store.register(
            xBandInstrumentFunctionalGroup,
            input.instrumentFunctionalGroup,
        );
    }
    if (input.songTag) {
        store.register(xBandSongTag, input.songTag);
    }
    if (input.songCreditType) {
        store.register(xSongCreditType, input.songCreditType);
    }
    if (input.instrument) {
        store.register(xBandInstrument, input.instrument);
    }
}


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:33-33
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 4a3ad4cf6726a83a9e44220e8d24737d3fb9954c28f88f12ae7852aae388d7dd
// MIGRATION_REFERENCE_BEGIN
// import { xPermission, xRole } from "../schema/user";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:42-70
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 936cf72e34c87903fa22cfd1e6df215e1b00eb5719a112dd55f568cabad2ec0c
// MIGRATION_REFERENCE_BEGIN
// const dashboardEventTypeSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
//     select: {
//         publicId: true,
//         isDeleted: true,
//         description: true,
//         color: true,
//         sortOrder: true,
//         iconName: true,
//         text: true,
//         significance: true,
//     },
// });
//
// const dashboardRoleSelection = Prisma.validator<Prisma.RoleDefaultArgs>()({
//     select: {
//         publicId: true,
//         name: true,
//         isRoleForNewUsers: true,
//         isPublicRole: true,
//         isSysAdminRole: true,
//         description: true,
//         sortOrder: true,
//         color: true,
//     },
// });
//
// const dashboardWikiPageTagSelection = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
//     select: {
//         publicId: true,
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:145-148
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 4ed056545b476a97d7f244cf1ea9e941dec7b45d96eb077351c7dd3b983de3d3
// MIGRATION_REFERENCE_BEGIN
// export const dashboardRoleResource = deriveViewContract(
//     xRole,
//     dashboardRoleSelection,
// );
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:212-232
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: fae1e0c42e9c8d80f8c880b50d5fec517bcdce620fbc48ca2401c871fd472ba7
// MIGRATION_REFERENCE_BEGIN
// export const userTagDashboardView = defineView({
//     viewID: "BandUserTag_Dashboard",
//     entity: xBandUserTag,
//     selection: dashboardUserTagResource.prismaSelection,
//     dtoSchema: dashboardUserTagResource.dtoSchema,
//     references: dashboardUserTagResource.referenceContract,
//     hydrate: dashboardUserTagResource.hydrate,
// });
//
// export const roleDashboardView = defineView({
//     viewID: "Role_Dashboard",
//     entity: xRole,
//     selection: dashboardRoleResource.prismaSelection,
//     dtoSchema: dashboardRoleResource.dtoSchema,
//     references: dashboardRoleResource.referenceContract,
//     hydrate: dashboardRoleResource.hydrate,
// });
//
// export const wikiPageTagDashboardView = defineView({
//     viewID: "WikiPageTag_Dashboard",
//     entity: xWikiPageTag,
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:323-327
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 9d506ba9fb4a874d77cb44a97f8b1735974c7704473a5d5b871fc89c361ee862
// MIGRATION_REFERENCE_BEGIN
// export type RoleDashboardClient = ClientOf<typeof roleDashboardView>;
// export type CompleteRoleDashboardClient = {
//     [TKey in keyof RoleDashboardClient]-?: Exclude<RoleDashboardClient[TKey], undefined>;
// };
// export type RoleDisplay = CompleteRoleDashboardClient;
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardReferences.ts:355-385
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 0d00d7b3f2a60d238756e70986870564cf8ee098ad2323101d40217f2e1e5c58
// MIGRATION_REFERENCE_BEGIN
// export function isCompleteEventAttendanceDashboardClient(
//     value: EventAttendanceDashboardClient,
// ): value is CompleteEventAttendanceDashboardClient {
//     return value.text !== undefined
//         && value.description !== undefined
//         && value.iconName !== undefined
//         && value.color !== undefined
//         && value.sortOrder !== undefined
//         && value.isDeleted !== undefined
//         && value.strength !== undefined
//         && value.personalText !== undefined
//         && value.pastText !== undefined
//         && value.pastPersonalText !== undefined
//         && value.isActive !== undefined;
// }
//
// export function isCompleteRoleDashboardClient(
//     value: RoleDashboardClient,
// ): value is CompleteRoleDashboardClient {
//     return value.name !== undefined
//         && value.isRoleForNewUsers !== undefined
//         && value.isPublicRole !== undefined
//         && value.isSysAdminRole !== undefined
//         && value.description !== undefined
//         && value.sortOrder !== undefined
//         && value.color !== undefined;
// }
//
// export function isCompleteWikiPageTagDashboardClient(
//     value: WikiPageTagDashboardClient,
// ): value is CompleteWikiPageTagDashboardClient {
// MIGRATION_REFERENCE_END
