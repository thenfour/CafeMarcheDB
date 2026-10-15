import { DbBrandConfig } from "@/shared/brandConfigBase";
import { concatenateUrlParts, isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { IsNullOrWhitespace } from "@/shared/utils";
import * as db3 from "@db3/db3";
import { Prisma } from "db";
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import type { EventAttendancePublicId, EventPublicId, EventStatusPublicId, EventTagPublicId, EventTypePublicId, FilePublicId, FileTagPublicId, InstrumentFunctionalGroupPublicId, InstrumentPublicId, PermissionPublicId, SongCreditTypePublicId, SongPublicId, SongTagPublicId, UserPublicId, UserTagPublicId, WikiPageTagPublicId } from "shared/publicId";
import { SettingsDto } from "../../db3/shared/schema/settings";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { portalHref, type BandHostingConfig } from "src/route/portalRouting";
import type { CurrentAccount } from "src/auth/shared/currentAccount";
import type { EventParticipantDto } from "../../db3/shared/entities/user/eventParticipant";

export abstract class DashboardContextDataBase {
    constructor(public portalHosting: BandHostingConfig) { }
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
    hasLimitedAccess = false;
    serverBaseUri: string;
    serverStartupState: ServerStartInfo | null; // null if not available (non-admins)

    localTimeZone: string;
    formattingLocale: string; // the locale used for formatting dates, numbers...

    // Presentation selects a band/language; the routing owner supplies deployment policy separately.
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

            // lsmb todo: no ad-hoc url construction.
            return this.getAbsoluteUri(portalHref(`/backstage/event/${parts.join("/")}`, this.memberPresentation, this.portalHosting));
        },

        getURIForSong: (song: { publicId: SongPublicId, name?: string }, tabSlug?: string) => {
            const parts: string[] = [song.publicId];
            if (song.name) parts.push(slugify(song.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
            // lsmb todo: no ad-hoc url construction.
            return this.getAbsoluteUri(portalHref(`/backstage/song/${parts.join("/")}`, this.memberPresentation, this.portalHosting));
        },

        getURIForUser: (user: { publicId: UserPublicId, name?: string }) => {
            const parts: string[] = [user.publicId];
            if (user.name) {
                parts.push(slugify(user.name));
            }
            // lsmb todo: no ad-hoc url construction.
            const path = this.memberPresentation.bandPublicId ? "/backstage/user" : "/backstage/platform-user";
            return this.getAbsoluteUri(portalHref(`${path}/${parts.join("/")}`, this.memberPresentation, this.portalHosting));
        },

        getURIForFile: (value: Prisma.FileGetPayload<{ select: { storedLeafName: true, fileLeafName: true, externalURI: true } }>) => {
            if (value.externalURI) {
                return value.externalURI;
            }
            if (!value.fileLeafName) {
                return this.getAbsoluteUri(portalHref(`/api/files/download/${value.storedLeafName}`, this.memberPresentation, this.portalHosting));
            }
            return this.getAbsoluteUri(portalHref(`/api/files/download/${value.storedLeafName}/${slugify(value.fileLeafName)}`, this.memberPresentation, this.portalHosting));
        },

        getURIForFileLandingPage: (value: { publicId: FilePublicId, slug?: string | null | undefined }) => {
            const path = IsNullOrWhitespace(value.slug)
                ? `/backstage/file/${value.publicId}`
                : `/backstage/file/${value.publicId}/${slugify(value.slug || "")}`;
            return this.getAbsoluteUri(portalHref(path, this.memberPresentation, this.portalHosting));
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
