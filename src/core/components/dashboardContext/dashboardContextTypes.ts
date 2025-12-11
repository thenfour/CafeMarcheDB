import { DbBrandConfig } from "@/shared/brandConfigBase";
import { isAbsoluteUri, slugify, TableAccessor } from "@/shared/rootroot";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { concatenateUrlParts, IsNullOrWhitespace } from "@/shared/utils";
import * as db3 from "@db3/db3";
import { Prisma } from "db";
import { EnrichedInstrument } from "../../db3/shared/schema/enrichedInstrumentTypes";

export abstract class DashboardContextDataBase {
    userTag: TableAccessor<Prisma.UserTagGetPayload<{}>>;
    eventType: TableAccessor<Prisma.EventTypeGetPayload<{}>>;
    eventStatus: TableAccessor<Prisma.EventStatusGetPayload<{}>>;
    eventTag: TableAccessor<Prisma.EventTagGetPayload<{}>>;
    eventAttendance: TableAccessor<Prisma.EventAttendanceGetPayload<{}>>;
    fileTag: TableAccessor<Prisma.FileTagGetPayload<{}>>;
    songTag: TableAccessor<Prisma.SongTagGetPayload<{}>>;
    songCreditType: TableAccessor<Prisma.SongCreditTypeGetPayload<{}>>;
    instrumentTag: TableAccessor<Prisma.InstrumentTagGetPayload<{}>>;
    eventCustomField: TableAccessor<Prisma.EventCustomFieldGetPayload<{}>>;

    wikiPageTag: TableAccessor<Prisma.WikiPageTagGetPayload<{}>>;

    dynMenuLinks: TableAccessor<db3.DashboardDynMenuLink>;
    permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    role: TableAccessor<Prisma.RoleGetPayload<{}>>;
    rolePermission: TableAccessor<Prisma.RolePermissionGetPayload<{}>>;

    instrument: TableAccessor<EnrichedInstrument<Prisma.InstrumentGetPayload<{ include: { instrumentTags: true } }>>>;
    instrumentFunctionalGroup: TableAccessor<Prisma.InstrumentFunctionalGroupGetPayload<{}>>;

    currentUser: db3.UserPayload | null;
    serverStartupState: ServerStartInfo;

    getAbsoluteUri = (relativePath: string): string => {
        // if relativePath is already absolute, return it as-is.
        if (isAbsoluteUri(relativePath)) {
            return relativePath;
        }
        return concatenateUrlParts(this.serverStartupState.baseUri, relativePath);
    };

    routingApi = {
        getURIForEvent: (event: Prisma.EventGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) => {
            const parts: string[] = [event.id.toString()];
            parts.push(slugify(event.name));
            if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");

            return this.getAbsoluteUri(`/backstage/event/${parts.join("/")}`);
        },

        getURIForSong: (song: Prisma.SongGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) => {
            const parts: string[] = [song.id.toString()];
            parts.push(slugify(song.name));
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
    abstract sortInstruments<Tinst extends Prisma.InstrumentGetPayload<{ select: { id: true, sortOrder: true, functionalGroupId: true } }>>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: number | null): boolean;
    abstract getVisibilityPermissions(): Prisma.PermissionGetPayload<{}>[];
}

