import { DbBrandConfig } from "@/shared/brandConfigBase";
import { isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { concatenateUrlParts, IsNullOrWhitespace } from "@/shared/utils";
import * as db3 from "@db3/db3";
import { Prisma } from "db";
import type { InstrumentFunctionalGroupPublicId, InstrumentTagPublicId, SongTagPublicId } from "shared/publicId";
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import { resolveUserSettings, UserSettings } from "shared/userSettings";

export abstract class DashboardContextDataBase {
    readonly referenceStore = db3.createDashboardReferenceStore();
    userSettings: UserSettings = resolveUserSettings();
    bandTimeZone: string = DEFAULT_BAND_TIME_ZONE;
    userTag: TableAccessor<db3.UserTagDashboardClient>;
    eventType: TableAccessor<db3.ClientOf<typeof db3.eventTypeDashboardView>>;
    eventStatus: TableAccessor<db3.ClientOf<typeof db3.eventStatusDashboardView>>;
    eventTag: TableAccessor<db3.ClientOf<typeof db3.eventTagDashboardView>>;
    eventAttendance: TableAccessor<db3.CompleteEventAttendanceDashboardClient>;
    fileTag: TableAccessor<db3.ClientOf<typeof db3.fileTagDashboardView>>;
    songTag: TableAccessor<db3.ClientOf<typeof db3.songTagDashboardView>, SongTagPublicId>;
    songCreditType: TableAccessor<db3.ClientOf<typeof db3.songCreditTypeDashboardView>>;
    instrumentTag: TableAccessor<
        db3.ClientOf<typeof db3.instrumentTagDashboardView>,
        InstrumentTagPublicId
    >;

    wikiPageTag: TableAccessor<db3.CompleteWikiPageTagDashboardClient>;

    dynMenuLinks: TableAccessor<db3.MenuLinkListClient>;
    permission: TableAccessor<db3.ClientOf<typeof db3.permissionDashboardView>>;
    role: TableAccessor<db3.CompleteRoleDashboardClient>;

    instrument: TableAccessor<db3.InstrumentDashboardClient>;
    instrumentFunctionalGroup: TableAccessor<
        db3.ClientOf<typeof db3.instrumentFunctionalGroupDashboardView>,
        InstrumentFunctionalGroupPublicId
    >;

    currentUser: db3.UserPayload | null;
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
        getURIForEvent: (event: Prisma.EventGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) => {
            const parts: string[] = [event.id.toString()];
            parts.push(slugify(event.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");

            return this.getAbsoluteUri(`/backstage/event/${parts.join("/")}`);
        },

        getURIForSong: (song: { id: number, name?: string }, tabSlug?: string) => {
            const parts: string[] = [song.id.toString()];
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

        getURIForFileLandingPage: (value: { id: number, slug?: string | null | undefined }) => {
            if (IsNullOrWhitespace(value.slug)) {
                return this.getAbsoluteUri(`/backstage/file/${value.id}`);
            };
            return this.getAbsoluteUri(`/backstage/file/${value.id}/${slugify(value.slug || "")}`);
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

    relevantEventIds: number[];

    brand: DbBrandConfig;

    abstract partitionEventSegmentsByCancellation<Tseg extends Prisma.EventSegmentGetPayload<{ select: { statusId: true } }>>(segments: Tseg[]): [Tseg[], Tseg[]];
    abstract sortInstruments<Tinst extends { sortOrder: number, functionalGroupId: InstrumentFunctionalGroupPublicId }>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: number | null): boolean;
    abstract getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[];
}

