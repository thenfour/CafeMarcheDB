import { DbBrandConfig } from "@/shared/brandConfigBase";
import { isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
import type { EventAttendancePublicId, EventPublicId, FilePublicId, InstrumentPublicId, PermissionPublicId, RolePublicId, SongPublicId } from "shared/publicId";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { concatenateUrlParts, IsNullOrWhitespace } from "@/shared/utils";
import * as db3 from "@db3/db3";
import { Prisma } from "db";
import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId, FileTagPublicId, InstrumentFunctionalGroupPublicId, InstrumentTagPublicId, SongCreditTypePublicId, SongTagPublicId, UserTagPublicId, WikiPageTagPublicId } from "shared/publicId";
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import { resolveUserSettings, UserSettings } from "shared/userSettings";

export abstract class DashboardContextDataBase {
    referenceStore = db3.createDashboardReferenceStore();
    userSettings: UserSettings = resolveUserSettings();
    bandTimeZone: string = DEFAULT_BAND_TIME_ZONE;
    userTag: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>;
    eventType: TableAccessor<db3.ClientOf<typeof db3.eventTypeDashboardView>, EventTypePublicId>;
    eventStatus: TableAccessor<db3.ClientOf<typeof db3.eventStatusDashboardView>, EventStatusPublicId>;
    eventTag: TableAccessor<db3.ClientOf<typeof db3.eventTagDashboardView>, EventTagPublicId>;
    eventAttendance: TableAccessor<db3.CompleteEventAttendanceDashboardClient, EventAttendancePublicId>;
    fileTag: TableAccessor<db3.ClientOf<typeof db3.fileTagDashboardView>, FileTagPublicId>;
    songTag: TableAccessor<db3.ClientOf<typeof db3.songTagDashboardView>, SongTagPublicId>;
    songCreditType: TableAccessor<db3.ClientOf<typeof db3.songCreditTypeDashboardView>, SongCreditTypePublicId>;
    instrumentTag: TableAccessor<
        db3.ClientOf<typeof db3.instrumentTagDashboardView>,
        InstrumentTagPublicId
    >;

    wikiPageTag: TableAccessor<db3.CompleteWikiPageTagDashboardClient, WikiPageTagPublicId>;

    dynMenuLinks: TableAccessor<db3.MenuLinkListClient>;
    permission: TableAccessor<db3.ClientOf<typeof db3.permissionDashboardView>, PermissionPublicId>;
    role: TableAccessor<db3.CompleteRoleDashboardClient, RolePublicId>;

    instrument: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>;
    instrumentFunctionalGroup: TableAccessor<
        db3.ClientOf<typeof db3.instrumentFunctionalGroupDashboardView>,
        InstrumentFunctionalGroupPublicId
    >;

    currentUser: db3.UserClientPayload | null;
    serverBaseUri: string;
    serverStartupState: ServerStartInfo | null; // null if not available (non-admins)

    localTimeZone: string;
    userLocale: string = typeof navigator === "undefined" ? "en" : navigator.language;

    eventDatePresentation: {
        bandTimeZone: string;
        viewerTimeZone: string;
        locale: string;
    }

    getAbsoluteUri = (relativePath: string): string => {
        // if relativePath is already absolute, return it as-is.
        if (isAbsoluteUri(relativePath)) {
            return relativePath;
        }
        return concatenateUrlParts(this.serverBaseUri, relativePath);
    };

    routingApi = {
        getURIForEvent: (event: { publicId: EventPublicId; name?: string }, tabSlug?: string) => {
            const parts: string[] = [event.publicId];
            if (event.name) parts.push(slugify(event.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");

            return this.getAbsoluteUri(`/backstage/event/${parts.join("/")}`);
        },

        getURIForSong: (song: { publicId: SongPublicId, name?: string }, tabSlug?: string) => {
            const parts: string[] = [song.publicId];
            if (song.name) parts.push(slugify(song.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
            return this.getAbsoluteUri(`/backstage/song/${parts.join("/")}`);
        },

        getURIForUser: (user: { id: number, name?: string }) => {
            const parts: string[] = [user.id.toString()];
            if (user.name) {
                parts.push(slugify(user.name));
            }
            return this.getAbsoluteUri(`/backstage/user/${parts.join("/")}`);
        },

        getURIForFile: (value: Prisma.FileGetPayload<{ select: { storedLeafName: true, fileLeafName: true, externalURI: true } }>) => {
            if (value.externalURI) {
                return value.externalURI;
            }
            if (!value.fileLeafName) {
                return this.getAbsoluteUri(`/api/files/download/${value.storedLeafName}`);
            }
            return this.getAbsoluteUri(`/api/files/download/${value.storedLeafName}/${slugify(value.fileLeafName)}`);
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
    abstract sortInstruments<Tinst extends { sortOrder: number, functionalGroupId: InstrumentFunctionalGroupPublicId }>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: EventAttendancePublicId | null): boolean;
    abstract getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[];
}

