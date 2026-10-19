import { xBandEventTag, bandEventTagDisplayContract } from "../entities/event/eventTagCatalogs";
// one could argue "why is dashboard stuff in db3"?
// but db3 has basically 2 layers: the core ORM-like layer, and an application-specific
// layer that understands the CMDB schema.

import {
    DB3ReferenceStore,
    defineReferenceContract,
    reference,
} from "../core/db3Hydration";
import { type ClientOf, defineView } from "../core/db3View";
import {
    xEventAttendance,
    xEventStatus,
    xEventType,
} from "../schema/event";
import { xBandFileTag, bandFileTagDisplayContract } from "../entities/file/fileTagCatalogs";
import {
    xBandInstrument,
    xBandInstrumentFunctionalGroup,
    bandInstrumentGroupDisplayContract,
    bandInstrumentDisplayContract,
} from "../entities/instrument/bandInstrumentContracts";
import { permissionDisplayContract } from "../entities/user/permissionViews";
import { xSongCreditType, songCreditTypeDisplayContract } from "../entities/song/songCreditTypes";
import { xBandSongTag, bandSongTagDisplayContract } from "../entities/song/bandSongTagViews";
import { xPermission } from "../schema/user";
import { xBandUserTag, bandUserTagDisplayContract } from "../entities/user/bandUserTagViews";
import { xBandWikiPageTag, bandWikiPageTagDisplayContract } from "../entities/wikiPageTag/wikiPageTagViews";

import { eventTypeDisplayContract, eventStatusDisplayContract, eventAttendanceDisplayContract } from "../entities/event/eventCatalogs";
import { graft } from "../entities/common/viewCommon";
import { asPermission } from "@/shared/permissions";

// dashboard provider provides "hydrated" objects, not raw db rows
// (e.g. ColorPaletteEntry rather than `string`).
// use the actual db3 view mechanism to do this;  it means prisma select -> dto schema -> hydration with xTable column metadata


// These projections and conversions are private details of the dashboard
// provider. DB3 views see only dashboardReferenceContract's per-entity output
// types; another provider may construct completely different values.
export const dashboardPermissionResource = permissionDisplayContract;
export const dashboardUserTagResource = bandUserTagDisplayContract;
export const dashboardWikiPageTagResource = bandWikiPageTagDisplayContract;
export const dashboardEventTypeResource = eventTypeDisplayContract;
export const dashboardEventStatusResource = eventStatusDisplayContract;
export const dashboardEventTagResource = bandEventTagDisplayContract;
export const dashboardEventAttendanceResource = eventAttendanceDisplayContract;
export const dashboardFileTagResource = bandFileTagDisplayContract;
export const dashboardInstrumentFunctionalGroupResource = bandInstrumentGroupDisplayContract;
export const dashboardSongTagResource = bandSongTagDisplayContract;
export const dashboardSongCreditTypeResource = songCreditTypeDisplayContract;

export const dashboardLeafReferenceContract = defineReferenceContract({
    userTag: reference(xBandUserTag)<ReturnType<typeof dashboardUserTagResource.hydrate>>(),
    permission: reference(xPermission)<ReturnType<typeof dashboardPermissionResource.hydrate>>(),
    wikiPageTag: reference(xBandWikiPageTag)<ReturnType<typeof dashboardWikiPageTagResource.hydrate>>(),
    eventType: reference(xEventType)<ReturnType<typeof dashboardEventTypeResource.hydrate>>(),
    eventStatus: reference(xEventStatus)<ReturnType<typeof dashboardEventStatusResource.hydrate>>(),
    eventTag: reference(xBandEventTag)<ReturnType<typeof dashboardEventTagResource.hydrate>>(),
    eventAttendance: reference(xEventAttendance)<ReturnType<typeof dashboardEventAttendanceResource.hydrate>>(),
    fileTag: reference(xBandFileTag)<ReturnType<typeof dashboardFileTagResource.hydrate>>(),
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
    hydrate: (dto, context) => {
        return graft(
            dashboardPermissionResource.hydrate(dto, context),
            {
                name: asPermission(dto.name)
            }
        );
    },
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
    entity: xBandWikiPageTag,
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
    entity: xBandFileTag,
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
export type WikiPageTagDisplay = WikiPageTagDashboardClient;
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

export type DashboardReferenceContract = typeof dashboardReferenceContract;
export type DashboardReferenceStore = DB3ReferenceStore<DashboardReferenceContract>;

export interface DashboardReferenceInput {
    userTag?: readonly ClientOf<typeof userTagDashboardView>[];
    permission?: readonly ClientOf<typeof permissionDashboardView>[];
    wikiPageTag?: readonly WikiPageTagDashboardClient[];
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
        store.register(xBandWikiPageTag, input.wikiPageTag);
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
        store.register(xBandFileTag, input.fileTag);
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
