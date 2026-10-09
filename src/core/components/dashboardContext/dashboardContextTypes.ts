import { DbBrandConfig } from "@/shared/brandConfigBase";
import { isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { concatenateUrlParts, IsNullOrWhitespace } from "@/shared/utils";
import * as db3 from "@db3/db3";
import { Prisma } from "db";
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import type { EventAttendancePublicId, EventPublicId, EventStatusPublicId, EventTagPublicId, EventTypePublicId, FilePublicId, FileTagPublicId, InstrumentFunctionalGroupPublicId, InstrumentPublicId, PermissionPublicId, SongCreditTypePublicId, SongPublicId, SongTagPublicId, UserPublicId, UserTagPublicId, WikiPageTagPublicId } from "shared/publicId";
import { SettingsDto } from "../../db3/shared/schema/settings";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { withMemberPresentation } from "../user/bandMemberLinks";
import type { CurrentAccount } from "src/auth/shared/currentAccount";
import type { EventParticipantDto } from "../../db3/shared/entities/user/eventParticipant";

export abstract class DashboardContextDataBase {
    referenceStore = db3.createDashboardReferenceStore();

    settings: SettingsDto;

    bandTimeZone: string = DEFAULT_BAND_TIME_ZONE;
    userTag: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>;
    eventType: TableAccessor<db3.ClientOf<typeof db3.eventTypeDashboardView>, EventTypePublicId>;
    eventStatus: TableAccessor<db3.ClientOf<typeof db3.eventStatusDashboardView>, EventStatusPublicId>;
    eventTag: TableAccessor<db3.ClientOf<typeof db3.eventTagDashboardView>, EventTagPublicId>;
    eventAttendance: TableAccessor<db3.CompleteEventAttendanceDashboardClient, EventAttendancePublicId>;
    fileTag: TableAccessor<db3.ClientOf<typeof db3.fileTagDashboardView>, FileTagPublicId>;
    songTag: TableAccessor<db3.ClientOf<typeof db3.songTagDashboardView>, SongTagPublicId>;
    songCreditType: TableAccessor<db3.ClientOf<typeof db3.songCreditTypeDashboardView>, SongCreditTypePublicId>;

    wikiPageTag: TableAccessor<db3.WikiPageTagDashboardClient, WikiPageTagPublicId>;

    dynMenuLinks: TableAccessor<db3.MenuLinkListClient>;
    permission: TableAccessor<db3.ClientOf<typeof db3.permissionDashboardView>, PermissionPublicId>;

    instrument: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>;
    instrumentFunctionalGroup: TableAccessor<
        db3.ClientOf<typeof db3.instrumentFunctionalGroupDashboardView>,
        InstrumentFunctionalGroupPublicId
    >;

    currentUser: CurrentAccount | null;
    currentMembership: EventParticipantDto | null = null;
    serverBaseUri: string;
    serverStartupState: ServerStartInfo | null; // null if not available (non-admins)

    localTimeZone: string;
    formattingLocale: string; // the locale used for formatting dates, numbers...

    // TODO: do not put such specific data here. 
    // this is used for generating URLs with  query parameters; it should move to
    // 1. general-purpose routing  logic
    // 2. a correct routing API - when that work is ready to be implemented. for now we consider this an acceptable temporary solution.
    memberPresentation: Pick<PresentationInput, "bandPublicId" | "routeLocale"> = {};

    eventDatePresentation: {
        bandTimeZone: string;
        viewerTimeZone: string;
        locale: string;
    }

    // LSMB todo: move this to cmdbrouter
    getAbsoluteUri = (relativePath: string): string => {
        // if relativePath is already absolute, return it as-is.
        if (isAbsoluteUri(relativePath)) {
            return relativePath;
        }
        return concatenateUrlParts(this.serverBaseUri, relativePath);
    };

    // LSMB todo: move this to cmdbrouter
    routingApi = {
        getURIForEvent: (event: { publicId: EventPublicId; name?: string }, tabSlug?: string) => {
            const parts: string[] = [event.publicId];
            if (event.name) parts.push(slugify(event.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");

            return this.getAbsoluteUri(withMemberPresentation(`/backstage/event/${parts.join("/")}`, this.memberPresentation));
        },

        getURIForSong: (song: { publicId: SongPublicId, name?: string }, tabSlug?: string) => {
            const parts: string[] = [song.publicId];
            if (song.name) parts.push(slugify(song.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
            return this.getAbsoluteUri(withMemberPresentation(`/backstage/song/${parts.join("/")}`, this.memberPresentation));
        },

        getURIForUser: (user: { publicId: UserPublicId, name?: string }) => {
            const parts: string[] = [user.publicId];
            if (user.name) {
                parts.push(slugify(user.name));
            }
            return this.getAbsoluteUri(withMemberPresentation(`/backstage/user/${parts.join("/")}`, this.memberPresentation));
        },

        getURIForFile: (value: Prisma.FileGetPayload<{ select: { storedLeafName: true, fileLeafName: true, externalURI: true } }>) => {
            if (value.externalURI) {
                return value.externalURI;
            }
            if (!value.fileLeafName) {
                return this.getAbsoluteUri(withMemberPresentation(`/api/files/download/${value.storedLeafName}`, this.memberPresentation));
            }
            return this.getAbsoluteUri(withMemberPresentation(`/api/files/download/${value.storedLeafName}/${slugify(value.fileLeafName)}`, this.memberPresentation));
        },

        getURIForFileLandingPage: (value: { publicId: FilePublicId, slug?: string | null | undefined }) => {
            if (IsNullOrWhitespace(value.slug)) {
                return this.getAbsoluteUri(`/backstage/file/${value.publicId}`);
            };
            return this.getAbsoluteUri(`/backstage/file/${value.publicId}/${slugify(value.slug || "")}`);
        },

        getURLClass: (url: string, baseDomain: string = window.location.hostname): "internalPage" | "internalAPI" | "external" => {
            try {
                const parsedUrl = new URL(url, window.location.origin);
                if (parsedUrl.hostname !== baseDomain) {
                    return "external";
                }
                if (parsedUrl.pathname.includes('/api/')) {
                    return "internalAPI";
                }
                return "internalPage";
            } catch (error) {
                // Handling relative URLs
                if (url.includes('/api/')) {
                    return "internalAPI";
                } else if (url.startsWith('http') || url.startsWith('//')) {
                    return "external";
                }
                return "internalPage";
            }
        },

    };

    relevantEventIds: EventPublicId[];

    brand: DbBrandConfig;

    abstract partitionEventSegmentsByCancellation<
        Tseg extends { statusId: EventStatusPublicId | null },
    >(segments: Tseg[]): [Tseg[], Tseg[]];
    abstract sortInstruments<Tinst extends { sortOrder?: number, functionalGroupId: InstrumentFunctionalGroupPublicId }>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: EventAttendancePublicId | null): boolean;
    abstract getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[];
}


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/components/dashboardContext/dashboardContextTypes.ts:1-146
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 1166a3716f5e3aabb07af4e48bb93b2290ef8f1bb64bc005e2a19e8c88b77c23
// MIGRATION_REFERENCE_BEGIN
// import { DbBrandConfig } from "@/shared/brandConfigBase";
// import { isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
// import { ServerStartInfo } from "@/shared/serverStateBase";
// import { concatenateUrlParts, IsNullOrWhitespace } from "@/shared/utils";
// import * as db3 from "@db3/db3";
// import { Prisma } from "db";
// import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
// import type { EventAttendancePublicId, EventPublicId, EventStatusPublicId, EventTagPublicId, EventTypePublicId, FilePublicId, FileTagPublicId, InstrumentFunctionalGroupPublicId, InstrumentPublicId, PermissionPublicId, RolePublicId, SongCreditTypePublicId, SongPublicId, SongTagPublicId, UserPublicId, UserTagPublicId, WikiPageTagPublicId } from "shared/publicId";
// import { SettingsDto } from "../../db3/shared/schema/settings";
// import type { PresentationInput } from "src/locale/shared/presentationInput";
// import { withMemberPresentation } from "../user/bandMemberLinks";
// import type { CurrentAccount } from "src/auth/shared/currentAccount";
// import type { BandUserInstrumentsDto } from "../../db3/shared/entities/user/bandUserInstruments";
//
// export abstract class DashboardContextDataBase {
//     referenceStore = db3.createDashboardReferenceStore();
//
//     settings: SettingsDto;
//
//     bandTimeZone: string = DEFAULT_BAND_TIME_ZONE;
//     userTag: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>;
//     eventType: TableAccessor<db3.ClientOf<typeof db3.eventTypeDashboardView>, EventTypePublicId>;
//     eventStatus: TableAccessor<db3.ClientOf<typeof db3.eventStatusDashboardView>, EventStatusPublicId>;
//     eventTag: TableAccessor<db3.ClientOf<typeof db3.eventTagDashboardView>, EventTagPublicId>;
//     eventAttendance: TableAccessor<db3.CompleteEventAttendanceDashboardClient, EventAttendancePublicId>;
//     fileTag: TableAccessor<db3.ClientOf<typeof db3.fileTagDashboardView>, FileTagPublicId>;
//     songTag: TableAccessor<db3.ClientOf<typeof db3.songTagDashboardView>, SongTagPublicId>;
//     songCreditType: TableAccessor<db3.ClientOf<typeof db3.songCreditTypeDashboardView>, SongCreditTypePublicId>;
//
//     wikiPageTag: TableAccessor<db3.CompleteWikiPageTagDashboardClient, WikiPageTagPublicId>;
//
//     dynMenuLinks: TableAccessor<db3.MenuLinkListClient>;
//     permission: TableAccessor<db3.ClientOf<typeof db3.permissionDashboardView>, PermissionPublicId>;
//     role: TableAccessor<db3.CompleteRoleDashboardClient, RolePublicId>;
//
//     instrument: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>;
//     instrumentFunctionalGroup: TableAccessor<
//         db3.ClientOf<typeof db3.instrumentFunctionalGroupDashboardView>,
//         InstrumentFunctionalGroupPublicId
//     >;
//
//     currentUser: CurrentAccount | null;
//     currentMembership: BandUserInstrumentsDto | null = null;
//     serverBaseUri: string;
//     serverStartupState: ServerStartInfo | null; // null if not available (non-admins)
//
//     localTimeZone: string;
//     formattingLocale: string; // the locale used for formatting dates, numbers...
//
//     // TODO: do not put such specific data here.
//     // this is used for generating URLs with  query parameters; it should move to
//     // 1. general-purpose routing  logic
//     // 2. a correct routing API - when that work is ready to be implemented. for now we consider this an acceptable temporary solution.
//     memberPresentation: Pick<PresentationInput, "bandPublicId" | "routeLocale"> = {};
//
//     eventDatePresentation: {
//         bandTimeZone: string;
//         viewerTimeZone: string;
//         locale: string;
//     }
//
//     // LSMB todo: move this to cmdbrouter
//     getAbsoluteUri = (relativePath: string): string => {
//         // if relativePath is already absolute, return it as-is.
//         if (isAbsoluteUri(relativePath)) {
//             return relativePath;
//         }
//         return concatenateUrlParts(this.serverBaseUri, relativePath);
//     };
//
//     // LSMB todo: move this to cmdbrouter
//     routingApi = {
//         getURIForEvent: (event: { publicId: EventPublicId; name?: string }, tabSlug?: string) => {
//             const parts: string[] = [event.publicId];
//             if (event.name) parts.push(slugify(event.name));
//             if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
//
//             return this.getAbsoluteUri(`/backstage/event/${parts.join("/")}`);
//         },
//
//         getURIForSong: (song: { publicId: SongPublicId, name?: string }, tabSlug?: string) => {
//             const parts: string[] = [song.publicId];
//             if (song.name) parts.push(slugify(song.name));
//             if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
//             return this.getAbsoluteUri(`/backstage/song/${parts.join("/")}`);
//         },
//
//         getURIForUser: (user: { publicId: UserPublicId, name?: string }) => {
//             const parts: string[] = [user.publicId];
//             if (user.name) {
//                 parts.push(slugify(user.name));
//             }
//             return this.getAbsoluteUri(withMemberPresentation(`/backstage/user/${parts.join("/")}`, this.memberPresentation));
//         },
//
//         getURIForFile: (value: Prisma.FileGetPayload<{ select: { storedLeafName: true, fileLeafName: true, externalURI: true } }>) => {
//             if (value.externalURI) {
//                 return value.externalURI;
//             }
//             if (!value.fileLeafName) {
//                 return this.getAbsoluteUri(`/api/files/download/${value.storedLeafName}`);
//             }
//             return this.getAbsoluteUri(`/api/files/download/${value.storedLeafName}/${slugify(value.fileLeafName)}`);
//         },
//
//         getURIForFileLandingPage: (value: { publicId: FilePublicId, slug?: string | null | undefined }) => {
//             if (IsNullOrWhitespace(value.slug)) {
//                 return this.getAbsoluteUri(`/backstage/file/${value.publicId}`);
//             };
//             return this.getAbsoluteUri(`/backstage/file/${value.publicId}/${slugify(value.slug || "")}`);
//         },
//
//         getURLClass: (url: string, baseDomain: string = window.location.hostname): "internalPage" | "internalAPI" | "external" => {
//             try {
//                 const parsedUrl = new URL(url, window.location.origin);
//                 if (parsedUrl.hostname !== baseDomain) {
//                     return "external";
//                 }
//                 if (parsedUrl.pathname.includes('/api/')) {
//                     return "internalAPI";
//                 }
//                 return "internalPage";
//             } catch (error) {
//                 // Handling relative URLs
//                 if (url.includes('/api/')) {
//                     return "internalAPI";
//                 } else if (url.startsWith('http') || url.startsWith('//')) {
//                     return "external";
//                 }
//                 return "internalPage";
//             }
//         },
//
//     };
//
//     relevantEventIds: EventPublicId[];
//
//     brand: DbBrandConfig;
//
//     abstract partitionEventSegmentsByCancellation<
//         Tseg extends { statusId: EventStatusPublicId | null },
//     >(segments: Tseg[]): [Tseg[], Tseg[]];
//     abstract sortInstruments<Tinst extends { sortOrder?: number, functionalGroupId: InstrumentFunctionalGroupPublicId }>(instruments: Tinst[]): Tinst[];
//     abstract isAttendanceIdGoing(attendanceId: EventAttendancePublicId | null): boolean;
//     abstract getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[];
// }
// MIGRATION_REFERENCE_END
