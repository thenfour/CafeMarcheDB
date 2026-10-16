import { DbBrandConfig } from "@/shared/brandConfigBase";
import { TableAccessor } from "@/shared/rootroot";
import * as db3 from "@db3/db3";
import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import type { EventAttendancePublicId, EventPublicId, EventStatusPublicId, EventTagPublicId, EventTypePublicId, FileTagPublicId, InstrumentFunctionalGroupPublicId, InstrumentPublicId, PermissionPublicId, SongCreditTypePublicId, SongTagPublicId, UserTagPublicId, WikiPageTagPublicId } from "shared/publicId";
import type { CurrentAccount } from "src/auth/shared/currentAccount";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import type { EventParticipantDto } from "../../db3/shared/entities/user/eventParticipant";
import { SettingsDto } from "../../db3/shared/schema/settings";

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
    hasLimitedAccess = false;

    localTimeZone: string;

    // the locale used for formatting dates, numbers... this is resolved differently than other localized content (strings)
    // strings resolve using availability & permissions in band  & platform; this is just used for client browser-based
    // formatting (does not care about availability)
    formattingLocale: string;

    // Presentation selects a band/language; the routing owner supplies deployment policy separately.
    memberPresentation: Pick<PresentationInput, "bandPublicId" | "routeLocale"> = {};

    eventDatePresentation: {
        bandTimeZone: string;
        viewerTimeZone: string;
        locale: string;
    }

    relevantEventIds: EventPublicId[];

    brand: DbBrandConfig;

    abstract partitionEventSegmentsByCancellation<
        Tseg extends { statusId: EventStatusPublicId | null },
    >(segments: Tseg[]): [Tseg[], Tseg[]];
    abstract sortInstruments<Tinst extends { sortOrder?: number, functionalGroupId: InstrumentFunctionalGroupPublicId }>(instruments: Tinst[]): Tinst[];
    abstract isAttendanceIdGoing(attendanceId: EventAttendancePublicId | null): boolean;
    abstract getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[];
}
