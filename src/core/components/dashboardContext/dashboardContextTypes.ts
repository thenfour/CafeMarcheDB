import { Prisma } from "db";
import { TableAccessor } from "@/shared/rootroot";
import * as db3 from "@db3/db3";
import { ServerStartInfo } from "@/shared/serverStateBase";
import { DbBrandConfig } from "@/shared/brandConfigBase";
import { EnrichedInstrument } from "../../db3/shared/schema/enrichedInstrumentTypes";
import { concatenateUrlParts } from "@/shared/utils";

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
        return concatenateUrlParts(this.serverStartupState.baseUri, relativePath);
    };

    relevantEventIds: number[];

    brand: DbBrandConfig;

    abstract partitionEventSegmentsByCancellation<Tseg extends Prisma.EventSegmentGetPayload<{ select: { statusId: true } }>>(segments: Tseg[]): [Tseg[], Tseg[]];
    abstract sortInstruments<Tinst extends Prisma.InstrumentGetPayload<{ select: { id: true, sortOrder: true, functionalGroupId: true } }>>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: number | null): boolean;
    abstract getVisibilityPermissions(): Prisma.PermissionGetPayload<{}>[];
}

