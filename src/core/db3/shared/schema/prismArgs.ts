import type { ColorPaletteEntry } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import type {
    EventAttendancePublicId,
    EventPublicId,
    EventSegmentPublicId,
    EventSegmentUserResponsePublicId,
    EventStatusPublicId,
    EventTagAssignmentPublicId,
    EventTagPublicId,
    EventTypePublicId,
    EventUserResponsePublicId,
    FilePublicId,
    FileTagPublicId,
    InstrumentFunctionalGroupPublicId,
    InstrumentPublicId,
    PermissionPublicId,
    SongPublicId,
    SongTagAssociationPublicId,
    SongTagPublicId,
    UserInstrumentPublicId,
    UserPublicId,
    UserTagAssignmentPublicId,
    UserTagPublicId,
    WikiPageTagAssignmentPublicId,
    WikiPageTagPublicId,
} from "shared/publicId";
//import * as db3 from "../db3core"; // circular
import { AuxUserArgs } from "types";
//import { DateRangeInfo } from "shared/time";

/*

this has been a weak point the whole durationg of this project: managing prism args & payloads.
queries need to know what to return to satisfy all callers.

i think we can potentially bundle types and parameterize the xTable instances. to be experimented with, needs a lot of thought.
from queries, to mutation payloads, includes, WHERE, selects, it all gets messy quickly.
from some search query, down to editing a tags field, knowing which fields of which relations, and how to bubble all that back to a query is not trivial
to do automatically.

one thing i never anticipated is the direction of these objects. is it:

event -> eventtags -> tags
or
tags -> eventtags -> event

it doesn't matter to the database of course, but it matters in code, because if you're on an "Events" page,
and you are quick filtering "Concert", you want to invoke the tags filtering

but if you're on the Tags, the same filtering may not behave the same. shall i care about that?
the fact that I'm using "local" vs. "foreign" everywhere suggests that it's necessary.

also when defining columns for these tables, there's a lot of redundancy.

EVENT             EVENTTAG       TAG
.taggedFiles      .eventID       .events
                  .tagID

but right now, the defs are similar for EVENT and TAG, just reversed.
and together, redundant then with the same column on EVENTTAG.

they should be defined outside of the table itself, and applied afterwards.






another big improvement will be better typing. so far i avoid it because of all the scattered prisma types for each model.
but it could be done by grouping them, and passing into xTable ctor.
interface DBTypes {
    WhereClause: Record<string, unknown>; // Generic placeholder
    Args: Record<string, unknown>; // Generic placeholder
    CreateInput: Record<string, unknown>; // Generic placeholder
}

interface UserDBTypes extends DBTypes {
    WhereClause: Prisma.UserWhereInput;
    Args: Prisma.UserArgs;
    CreateInput: Prisma.UserCreateInput;
};

interface EventDBTypes extends DBTypes {
    WhereClause: Prisma.EventWhereInput;
    Args: Prisma.EventArgs;
    CreateInput: Prisma.EventCreateInput;
};


const query = <T extends DBTypes,>(getCreateInput: () => T['CreateInput']) => {
}

query<EventDBTypes>(() => {
    return null;
});



*/

export interface DBTypes {
    Args: Record<string, unknown>; // 
    WhereInput: Record<string, unknown>; // 
    Include: Record<string, unknown>;
    Select: Record<string, unknown>;
    CreateInput: Record<string, unknown>; // 
}

export interface FileTypes extends DBTypes {
    Args: Prisma.FileArgs;
    WhereInput: Prisma.FileWhereInput;
    Include: Prisma.FileInclude;
    Select: Prisma.FileSelect;
    CreateInput: Prisma.FileCreateInput;
};


////////////////////////////////////////////////////////////////
export const EventTypeSignificance = {
    Concert: "Concert",
    Rehearsal: "Rehearsal",
    Weekend: "Weekend",
} as const satisfies Record<string, string>;

export enum EventStatusSignificance {
    New = "New",
    Cancelled = "Cancelled",
    FinalConfirmation = "FinalConfirmation",
};// as const satisfies Record<string, string>;

export const FileTagSignificance = {
    Partition: "Partition",
    Recording: "Recording",
    Rider: "Rider",
} as const satisfies Record<string, string>;

export const UserTagSignificance = {
    General: "General",
    DefaultInvitation: "DefaultInvitation",
} as const satisfies Record<string, string>;


////////////////////////////////////////////////////////////////
export const VisiblePermissionInclude = {
    include: { description: true },
};

export const PermissionArgs = Prisma.validator<Prisma.PermissionArgs>()({
    include: { description: true },
});
export type PermissionPayloadMinimum = Prisma.PermissionGetPayload<{}>;
export type PermissionPayload = Prisma.PermissionGetPayload<typeof PermissionArgs>;

export const PermissionForVisibilityArgs = Prisma.validator<Prisma.PermissionArgs>()({
    select: {
        publicId: true,
        name: true,
        isVisibility: true,
        description: true,
        sortOrder: true,
        significance: true,
        color: true,
        iconName: true,
    },
});

export const PermissionNaturalOrderBy: Prisma.PermissionOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { name: 'asc' },
    { id: 'asc' },
];




////////////////////////////////////////////////////////////////
export const SongTagArgs = Prisma.validator<Prisma.SongTagArgs>()({
    include: {
        songs: true
    }
});

export type SongTagPayload = Prisma.SongTagGetPayload<typeof SongTagArgs>;

export const SongTagNaturalOrderBy: Prisma.SongTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];
export const SongTagAssociationArgs = Prisma.validator<Prisma.SongTagAssociationDefaultArgs>()({
    include: {
        song: true,
        tag: true,
    },
});

export type SongTagAssociationPayload = Prisma.SongTagAssociationGetPayload<typeof SongTagAssociationArgs>;

export type SongTagClientPayload = Omit<
    Prisma.SongTagGetPayload<{}>,
    "id" | "publicId" | "color"
> & {
    publicId: SongTagPublicId;
    color: ColorPaletteEntry | null;
};

export type SongTagAssociationClientPayload = Omit<
    Prisma.SongTagAssociationGetPayload<{ include: { tag: true } }>,
    "id" | "publicId" | "songId" | "tagId" | "tag"
> & {
    publicId: SongTagAssociationPublicId;
    songId: SongPublicId;
    tagId: SongTagPublicId;
    tag: SongTagClientPayload;
};

export type SongTagAssociationReferenceClientPayload = Pick<
    SongTagAssociationClientPayload,
    "publicId" | "songId" | "tagId"
>;

export const SongTagAssociationNaturalOrderBy: Prisma.SongTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'asc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];

export const SongCreditTypeArgs = Prisma.validator<Prisma.SongCreditTypeArgs>()({
    include: {
        songCredits: true,
    }
});

export type SongCreditTypePayload = Prisma.SongCreditTypeGetPayload<typeof SongCreditTypeArgs>;

export const SongCreditTypeNaturalOrderBy: Prisma.SongCreditTypeOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];


export const SongCreditArgs = Prisma.validator<Prisma.SongCreditArgs>()({
    include: {
        song: true,
        user: true,
        type: true,
    }
});

export type SongCreditPayload = Prisma.SongCreditGetPayload<typeof SongCreditArgs>;

export const SongCreditNaturalOrderBy: Prisma.SongCreditOrderByWithRelationInput[] = [
    { id: 'asc' },
];


export const SongNaturalOrderBy: Prisma.SongOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
];











export const InstrumentArgs = Prisma.validator<Prisma.InstrumentArgs>()({
    include: {
        functionalGroup: true,
    }
});

export type InstrumentPayload = Prisma.InstrumentGetPayload<typeof InstrumentArgs>;

const InstrumentWithFunctionalGroupArgs = Prisma.validator<Prisma.InstrumentArgs>()({
    include: {
        functionalGroup: true,
    },
});
type InstrumentWithFunctionalGroupPayload = Prisma.InstrumentGetPayload<typeof InstrumentWithFunctionalGroupArgs>;


////////////////////////////////////////////////////////////////
export const InstrumentMinimumArgs = Prisma.validator<Prisma.InstrumentArgs>()({
    select: {
        id: true,
        name: true,
        sortOrder: true,
        functionalGroupId: true,
    }
});

export type InstrumentPayloadMinimum = Prisma.InstrumentGetPayload<typeof InstrumentMinimumArgs>;

const UserInstrumentReferenceArgs = Prisma.validator<Prisma.UserInstrumentArgs>()({
    include: {
        // Projection needs the target's public ID to translate instrumentId,
        // but event/user-map payloads do not need the full instrument record.
        instrument: { select: { id: true, publicId: true } },
    },
});

type PermissionForVisibilityDbPayload = Prisma.PermissionGetPayload<typeof PermissionForVisibilityArgs>;
export type PermissionForVisibilityPayload = Omit<PermissionForVisibilityDbPayload, "publicId" | "description"> & {
    publicId: PermissionPublicId;
    description: string | null;
};

export type PermissionClientPayload = Omit<Prisma.PermissionGetPayload<{}>, "id" | "publicId"> & {
    publicId: PermissionPublicId;
};

type UserInstrumentReferenceDbPayload = Prisma.UserInstrumentGetPayload<
    typeof UserInstrumentReferenceArgs
>;

type UserInstrumentReferenceClientPayload = Omit<
    UserInstrumentReferenceDbPayload,
    "id" | "publicId" | "userId" | "instrumentId" | "instrument"
> & {
    publicId: UserInstrumentPublicId;
    userId: UserPublicId;
    instrumentId: InstrumentPublicId;
    instrument: { publicId: InstrumentPublicId };
};

const UserTagAssignmentReferenceArgs = Prisma.validator<Prisma.UserTagAssignmentArgs>()({
    include: {
        // As with instruments above, projection needs the public target even
        // though event user maps consume only userTagId.
        userTag: { select: { id: true, publicId: true } },
    },
});

type UserTagAssignmentReferenceDbPayload = Prisma.UserTagAssignmentGetPayload<
    typeof UserTagAssignmentReferenceArgs
>;

type UserTagAssignmentReferenceClientPayload = Omit<
    UserTagAssignmentReferenceDbPayload,
    "id" | "publicId" | "userId" | "userTagId" | "userTag"
> & {
    publicId: UserTagAssignmentPublicId;
    userId: UserPublicId;
    userTagId: UserTagPublicId;
    userTag: { publicId: UserTagPublicId };
};

export type UserPayload_Name = Prisma.UserGetPayload<{
    select: {
        publicId: true,
        name: true,
    }
}>;


//export type UserMinimumPayload = Prisma.UserGetPayload<{}>;

// Shared account reads contain person fields only. BandUser views own taxonomy and grants.
export const UserArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        id: true,
        publicId: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        cssClass: true,
        // Credentials, sign-in identifiers and feed secrets use dedicated readers.
    },
});

export type UserPayload = Prisma.UserGetPayload<typeof UserArgs>;
export type UserClientPayload = Omit<UserPayload, "id" | "publicId"> & {
    publicId: UserPublicId;
};

export const UserSafeArgs = UserArgs;

export const UserMinimumArgs = Prisma.validator<Prisma.UserArgs>()({
    select: {
        id: true,
        publicId: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        cssClass: true,
        // Explicitly exclude: hashedPassword, signInMethods, calendarFeedToken, uid
    }
});
type UserPayloadMinimumDb = Prisma.UserGetPayload<typeof UserMinimumArgs>;
export type UserPayloadMinimum = Omit<UserPayloadMinimumDb, "id" | "publicId"> & {
    publicId: UserPublicId;
};


export const UserForCalBackendArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        id: true,
        publicId: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        cssClass: true,
        uid: true,
    }
});
export type UserForCalBackendPayload = Prisma.UserGetPayload<typeof UserForCalBackendArgs>;


export const UserWithInstrumentsArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        id: true,
        publicId: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        cssClass: true,

        instruments: UserInstrumentReferenceArgs,
        tags: UserTagAssignmentReferenceArgs,
    }
});

export type UserWithInstrumentsDbPayload = Prisma.UserGetPayload<typeof UserWithInstrumentsArgs>;
export type UserWithInstrumentsClientPayload = Omit<
    UserWithInstrumentsDbPayload,
    "id" | "publicId" | "instruments" | "tags"
> & {
    publicId: UserPublicId;
    instruments: UserInstrumentReferenceClientPayload[];
    tags: UserTagAssignmentReferenceClientPayload[];
};
export type UserWithInstrumentsPayload = UserWithInstrumentsClientPayload;


export const UserNaturalOrderBy: Prisma.UserOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
];



// order by functional group, then by instrument.
export const InstrumentNaturalOrderBy: Prisma.InstrumentOrderByWithRelationInput[] = [
    {
        functionalGroup: {
            sortOrder: 'asc',
        }
    },
    { sortOrder: 'asc' },
    { name: 'asc' },
    { id: 'asc' },
];



////////////////////////////////////////////////////////////////
// a medium-verbosity song payload, used for non-primary things like song lists etc.
export const SongArgs = Prisma.validator<Prisma.SongArgs>()({
    include: {
        pinnedRecording: { select: { publicId: true } },
        createdByUser: AuxUserArgs,
        visiblePermission: true,
        //     visiblePermission: {
        //         include: {
        //         roles: true
        //     }
        // },
        tags: {
            include: {
                // Projection support for the converted SongTag foreign key.
                tag: true,
            },
        },
        //     include: {
        //         tag: true, // include foreign object
        //     },
        //     orderBy: {
        //         tag: { sortOrder: 'asc' }
        //     }
        // },
    }
});

export type SongPayload = Prisma.SongGetPayload<typeof SongArgs>;
export type SongClientPayload = Omit<SongPayload, "id" | "publicId" | "tags" | "pinnedRecording" | "pinnedRecordingId"> & {
    publicId: SongPublicId;
    pinnedRecordingId: FilePublicId | null;
    tags: SongTagAssociationClientPayload[];
};
export type SongPayloadMinimum = {
    publicId: SongPublicId;
    name: string,
};




////////////////////////////////////////////////////////////////
export const InstrumentFunctionalGroupArgs = Prisma.validator<Prisma.InstrumentFunctionalGroupArgs>()({
});

export type InstrumentFunctionalGroupPayload = Prisma.InstrumentFunctionalGroupGetPayload<typeof InstrumentFunctionalGroupArgs>;
export type InstrumentFunctionalGroupPayloadMinimum = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

// i'm thinking of a generic way to do this, but probably done together with an enrichment step.
export type InstrumentFunctionalGroupClientPayload = Omit<
    InstrumentFunctionalGroupPayload,
    "id" | "publicId" | "color"
> & {
    publicId: InstrumentFunctionalGroupPublicId;
    color: ColorPaletteEntry | null;
};

export type InstrumentClientPayload = Omit<
    InstrumentPayload,
    "id" | "publicId" | "functionalGroupId" | "functionalGroup"
> & {
    publicId: InstrumentPublicId;
    functionalGroupId: InstrumentFunctionalGroupPublicId;
    functionalGroup: InstrumentFunctionalGroupClientPayload;
};

// Some shared calculation code is also used by server-side/scenario data that
// still carries Prisma's numeric foreign key.
export type InstrumentClientOrDbPayload = InstrumentClientPayload | InstrumentPayload;

export type InstrumentIdentity = InstrumentPublicId | number;

export function getInstrumentIdentity(instrument: InstrumentClientOrDbPayload): InstrumentIdentity {
    return "id" in instrument ? instrument.id : instrument.publicId;
}

// replaces natural-id-variants from prisma with publicid variants.
export type InstrumentWithFunctionalGroupClientPayload = Omit<
    InstrumentWithFunctionalGroupPayload,
    "id" | "publicId" | "functionalGroupId" | "functionalGroup"
> & {
    publicId: InstrumentPublicId;
    functionalGroupId: InstrumentFunctionalGroupPublicId;
    functionalGroup: InstrumentFunctionalGroupClientPayload;
};

type DashboardInstrumentDbPayload = Prisma.InstrumentGetPayload<{
    include: {
        functionalGroup: true;
    };
}>;

export type DashboardInstrumentPayload = Omit<DashboardInstrumentDbPayload, "id" | "publicId" | "functionalGroupId" | "functionalGroup"> & {
    publicId: InstrumentPublicId;
    functionalGroupId: InstrumentFunctionalGroupPublicId;
    functionalGroup: InstrumentFunctionalGroupClientPayload;
};

export const InstrumentFunctionalGroupNaturalSortOrder: Prisma.InstrumentFunctionalGroupOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { name: 'asc' },
    { id: 'asc' },
];






export const UserMinimalSelect = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    name: true,
});

////////////////////////////////////////////////////////////////
// export const EventSongListDividerTextStyle = {
//     Default: "Default",
//     MonospaceTitle: "MonospaceTitle",
//     BreakBefore: "BreakBefore",
//     BreakAfter: "BreakAfter",
// } as const satisfies Record<string, string>;

export enum EventSongListDividerTextStyle {
    Default = "Default",
    DefaultBreak = "DefaultBreak",
    DefaultBreakBefore = "DefaultBreakBefore",
    DefaultBreakAfter = "DefaultBreakAfter",
    Title = "Title",
    TitleBreak = "TitleBreak",
    TitleBreakBefore = "TitleBreakBefore",
    TitleBreakAfter = "TitleBreakAfter",
    Minimal = "Minimal",
    MinimalBreak = "MinimalBreak",
    MinimalBreakBefore = "MinimalBreakBefore",
    MinimalBreakAfter = "MinimalBreakAfter",
};

////////////////////////////////////////////////////////////////

export const EventTagAssignmentArgs = Prisma.validator<Prisma.EventTagAssignmentArgs>()({
    include: {
        event: true,
        eventTag: true,
    }
});
export type EventTagAssignmentPayload = Prisma.EventTagAssignmentGetPayload<typeof EventTagAssignmentArgs>;


export const EventTagAssignmentNaturalOrderBy: Prisma.EventTagAssignmentOrderByWithRelationInput[] = [
    { eventTag: { sortOrder: 'asc' } },
    { eventTag: { text: 'asc' } },
    { eventTag: { id: 'asc' } },
];

// ////////////////////////////////////////////////////////////////
// export type EventPayloadMinimum = Prisma.EventGetPayload<{
//     select: {
//         id: true,
//         name: true,

//         startsAt: true,
//         durationMillis: true,
//         isAllDay: true,

//         typeId: true,
//         statusId: true,
//     }
// }>;
export type EventPayloadWithVisiblePermission = Prisma.EventGetPayload<{
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
    }
}>;

export const EventArgs = Prisma.validator<Prisma.EventArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        createdByUser: AuxUserArgs,
        status: true,
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            },
        },
        expectedAttendanceUserTag: true,
        type: true,
        responses: {
            include: {
                instrument: true,
                user: true,
            }
        },
        segments: {
            orderBy: { startsAt: "desc" },
            include: {
                responses: {
                    include: {
                        user: true,
                    }
                }
            },
        },
    },
});

export type EventPayload = Prisma.EventGetPayload<typeof EventArgs>;



export const EventWithTagsArgs = Prisma.validator<Prisma.EventArgs>()({
    include: {
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            }
        },
    },
});

export type EventWithTagsPayload = Prisma.EventGetPayload<typeof EventWithTagsArgs>;

export type EventTagAssignmentClientPayload = Omit<
    Prisma.EventTagAssignmentGetPayload<{}>,
    "id" | "publicId" | "eventId" | "eventTagId"
> & {
    publicId: EventTagAssignmentPublicId;
    eventId: EventPublicId;
    eventTagId: EventTagPublicId;
};


////////////////////////////////////////////////////////////////
export const EventUserResponseArgs = Prisma.validator<Prisma.EventUserResponseArgs>()({
    include: {
        instrument: InstrumentArgs,
        user: UserWithInstrumentsArgs,
    }
});

export type EventUserResponsePayload = Prisma.EventUserResponseGetPayload<{
    include: typeof EventUserResponseArgs.include
}>;


export const EventUserResponseNaturalOrderBy: Prisma.EventUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
export const EventSegmentUserResponseArgs = Prisma.validator<Prisma.EventSegmentUserResponseArgs>()({
    include: {
        attendance: true,
        eventSegment: true,
        //instrument: InstrumentArgs,
        user: UserWithInstrumentsArgs,
    }
});

export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<{
    include: typeof EventSegmentUserResponseArgs.include
}>;

export type EventSegmentUserResponseClientPayload = Omit<
    Prisma.EventSegmentUserResponseGetPayload<{}>, "id" | "publicId" | "eventSegmentId" | "attendanceId" | "userId" | "createdByUserId" | "updatedByUserId"
> & {
    publicId: EventSegmentUserResponsePublicId;
    eventSegmentId: EventSegmentPublicId;
    attendanceId: EventAttendancePublicId | null;
    userId: UserPublicId;
    createdByUserId: UserPublicId | null;
    updatedByUserId: UserPublicId | null;
};
export type EventUserResponseClientPayload = Omit<
    Prisma.EventUserResponseGetPayload<{}>, "id" | "publicId" | "eventId" | "instrumentId" | "userId"
> & {
    publicId: EventUserResponsePublicId;
    eventId: EventPublicId;
    instrumentId: InstrumentPublicId | null;
    userId: UserPublicId;
};

export const EventSegmentUserResponseNaturalOrderBy: Prisma.EventSegmentUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];



////////////////////////////////////////////////////////////////
export const EventSegmentArgs = Prisma.validator<Prisma.EventSegmentArgs>()({
    //orderBy: { startsAt: "desc" },
    include: {
        event: true,
        status: { select: { publicId: true } },
        responses: EventSegmentUserResponseArgs,
    }
});

export type EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

export type EventSegmentPayloadMinimum = Prisma.EventSegmentGetPayload<{}>;

export const EventSongListNaturalOrderBy: Prisma.EventSongListOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
];

export const EventSongListArgs = Prisma.validator<Prisma.EventSongListArgs>()({
    include: {
        event: true,
        dividers: {
            include: { eventSongList: { select: { publicId: true } } }
        },
        songs: {
            include: {
                song: SongArgs,
                eventSongList: { select: { publicId: true } },
            }
        }
    },
});

export type EventSongListPayload = Prisma.EventSongListGetPayload<typeof EventSongListArgs>;


export const EventSegmentNaturalOrderBy: Prisma.EventSegmentOrderByWithRelationInput[] = [
    // this is not completely correct because cancelled event segments should be separated from the rest. but i don't have significance available here.
    { startsAt: "asc" },
    { id: "asc" },
];

export function getCancelledStatusIds<TStatus extends { significance: string | null }, TIdentity extends number | string>(
    eventStatuses: TStatus[],
    getIdentity: (status: TStatus) => TIdentity,
): TIdentity[] {
    return eventStatuses
        .filter(status => status.significance === EventStatusSignificance.Cancelled)
        .map(getIdentity);
}

export const compareEventSegments = <TStatusIdentity extends number | string>(
    a: { startsAt: Date | null; statusId: TStatusIdentity | null },
    b: { startsAt: Date | null; statusId: TStatusIdentity | null },
    cancelledStatusIds: TStatusIdentity[],
) => {
    const a_isCancelled = a.statusId && cancelledStatusIds.includes(a.statusId);
    const b_isCancelled = b.statusId && cancelledStatusIds.includes(b.statusId);

    // Cancelled events come last
    if (a_isCancelled && !b_isCancelled) return 1;
    if (!a_isCancelled && b_isCancelled) return -1;

    if (a.startsAt === null) {
        if (b.startsAt === null) return 0;
        return 1;
    }
    if (b.startsAt === null) return -1;

    return a.startsAt.getTime() - b.startsAt.getTime();
};




////////////////////////////////////////////////////////////////
export type EventWithStatusPayload = Prisma.EventGetPayload<{
    include: {
        status: true,
    }
}>;
export type EventWithAttendanceUserTagPayload = Prisma.EventGetPayload<{
    include: {
        expectedAttendanceUserTag: true,
    }
}>;


export const EventSongListSongNaturalOrderBy: Prisma.EventSongListSongOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
];


////////////////////////////////////////////////////////////////
export const EventSongListSongArgs = Prisma.validator<Prisma.EventSongListSongArgs>()({
    include: {
        song: SongArgs,
        eventSongList: { select: { publicId: true } },
    }
});

export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<typeof EventSongListSongArgs>;


////////////////////////////////////////////////////////////////
export const EventSongListDividerArgs = Prisma.validator<Prisma.EventSongListDividerDefaultArgs>()({
    include: {
        eventSongList: { select: { publicId: true } },
    }
});

export type EventSongListDividerPayload = Prisma.EventSongListDividerGetPayload<typeof EventSongListDividerArgs>;


////////////////////////////////////////////////////////////////

export const EventTypeArgs = Prisma.validator<Prisma.EventTypeArgs>()({
    include: {
        events: {
            select: {
                id: true,
                name: true,
            }
        },
    }
});

export type EventTypePayload = Prisma.EventTypeGetPayload<typeof EventTypeArgs>;
export type EventTypeMinimumPayload = Prisma.EventTypeGetPayload<{}>;

export const EventTypeNaturalOrderBy: Prisma.EventTypeOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];






export type EventPayloadClient = Omit<EventPayload, "id" | "publicId" | "statusId" | "typeId"> & {
    publicId: EventPublicId;
    statusId: EventStatusPublicId | null;
    typeId: EventTypePublicId | null;
}; // used to include calculated fields

export const EventNaturalOrderBy: Prisma.EventOrderByWithRelationInput[] = [
    // while you can order by relation (ex orderByRelation): https://github.com/prisma/prisma/issues/5008
    // you can't do aggregations; for us sorting by soonest segment date would require a min() aggregation. https://stackoverflow.com/questions/67930989/prisma-order-by-relation-has-only-count-property-can-not-order-by-relation-fie
    // order by nulls
    // https://github.com/prisma/prisma/issues/14377
    { startsAt: { nulls: "last", sort: "asc" } }, // newest to latest
    //{ id: 'desc' }, // TODO: we should find a way to order by segment! can be done in SQL but not prisma afaik. ordering can just be done in code.
];


////////////////////////////////////////////////////////////////
export const FileTagArgs = Prisma.validator<Prisma.FileTagArgs>()({
    include: {
        fileAssignments: true,
    }
});

export type FileTagPayload = Prisma.FileTagGetPayload<typeof FileTagArgs>;

export type FileTagClientPayload = Omit<
    Prisma.FileTagGetPayload<{}>,
    "id" | "publicId" | "color"
> & {
    publicId: FileTagPublicId;
    color: ColorPaletteEntry | null;
};

export const FileTagNaturalOrderBy: Prisma.FileTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
export const FileTagAssignmentArgs = Prisma.validator<Prisma.FileTagAssignmentArgs>()({
    include: {
        file: true,
        fileTag: true,
    }
});
export type FileTagAssignmentPayload = Prisma.FileTagAssignmentGetPayload<typeof FileTagAssignmentArgs>;

export const FileTagAssignmentNaturalOrderBy: Prisma.FileTagAssignmentOrderByWithRelationInput[] = [
    { fileTag: { sortOrder: 'asc' } },
    { fileTag: { text: 'asc' } },
    { fileTag: { id: 'asc' } },
];




////////////////////////////////////////////////////////////////
export const UserTagArgs = Prisma.validator<Prisma.UserTagArgs>()({
    include: {
        userAssignments: {
            include: {
                user: UserWithInstrumentsArgs
            }
        },
    }
});

export type UserTagPayload = Prisma.UserTagGetPayload<typeof UserTagArgs>;

export const UserTagNaturalOrderBy: Prisma.UserTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
export const UserTagAssignmentArgs = Prisma.validator<Prisma.UserTagAssignmentArgs>()({
    include: {
        user: true,
        userTag: true,
    }
});
export type UserTagAssignmentPayload = Prisma.UserTagAssignmentGetPayload<typeof UserTagAssignmentArgs>;


export const UserTagAssignmentNaturalOrderBy: Prisma.UserTagAssignmentOrderByWithRelationInput[] = [
    { userTag: { sortOrder: 'asc' } },
    { userTag: { text: 'asc' } },
    { userTag: { id: 'asc' } },
];







////////////////////////////////////////////////////////////////
export const FileUserTagArgs = Prisma.validator<Prisma.FileUserTagArgs>()({
    include: {
        file: true,
        user: true,
    }
});
export type FileUserTagPayload = Prisma.FileUserTagGetPayload<typeof FileUserTagArgs>;
export const FileUserTagNaturalOrderBy: Prisma.FileUserTagOrderByWithRelationInput[] = [
    { user: { name: 'asc' } },
    { user: { id: 'asc' } },
];
////////////////////////////////////////////////////////////////
export const FileSongTagArgs = Prisma.validator<Prisma.FileSongTagArgs>()({
    include: {
        file: true,
        song: true,
    }
});
export type FileSongTagPayload = Prisma.FileSongTagGetPayload<typeof FileSongTagArgs>;
export const FileSongTagNaturalOrderBy: Prisma.FileSongTagOrderByWithRelationInput[] = [
    { song: { name: 'asc' } },
    { song: { id: 'asc' } },
];


////////////////////////////////////////////////////////////////
export const FileEventTagArgs = Prisma.validator<Prisma.FileEventTagArgs>()({
    include: {
        file: {
            include: { visiblePermission: { include: { roles: true } } }
        },
        event: {
            include: {
                type: { select: { publicId: true } },
                status: { select: { publicId: true } },
            },
        },
    }
});
export type FileEventTagPayload = Prisma.FileEventTagGetPayload<typeof FileEventTagArgs>;
// because it comes from the event payload, it doesn't include the event.
export const FileEventTagMinimumArgs = Prisma.validator<Prisma.FileEventTagArgs>()({
    include: {
        file: {
            include: { visiblePermission: { include: { roles: true } } }
        },
    }
});
export type FileEventTagMinimumPayload = Prisma.FileEventTagGetPayload<typeof FileEventTagMinimumArgs>;



export const FileEventTagNaturalOrderBy: Prisma.FileEventTagOrderByWithRelationInput[] = [
    { event: { name: 'asc' } },
    { event: { id: 'asc' } },
];



export const FileInstrumentTagArgs = Prisma.validator<Prisma.FileInstrumentTagArgs>()({
    include: {
        file: true,
        instrument: InstrumentWithFunctionalGroupArgs,
    }
});
export type FileInstrumentTagPayload = Prisma.FileInstrumentTagGetPayload<typeof FileInstrumentTagArgs>;
export type FileInstrumentTagPayloadWithInstrument = Prisma.FileInstrumentTagGetPayload<{
    include: {
        instrument: true,
    }
}>;

export const FileInstrumentTagNaturalOrderBy: Prisma.FileInstrumentTagOrderByWithRelationInput[] = [
    { instrument: { name: 'asc' } },
    { instrument: { id: 'asc' } },
];

////////////////////////////////////////////////////////////////
export const FileWikiPageTagArgs = Prisma.validator<Prisma.FileWikiPageTagArgs>()({
    include: {
        //file: true,
        wikiPage: true,
    }
});
export type FileWikiPageTagPayload = Prisma.FileWikiPageTagGetPayload<typeof FileWikiPageTagArgs>;
export const FileWikiPageTagNaturalOrderBy: Prisma.FileWikiPageTagOrderByWithRelationInput[] = [
    { wikiPage: { slug: 'asc' } },
    { wikiPage: { id: 'asc' } },
];

//////////////////////////////////////////////////////////////
export const WikiPageTagArgs = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
    include: {}
});
export type WikiPageTagPayload = Prisma.WikiPageTagGetPayload<typeof WikiPageTagArgs>;
export type WikiPageTagClientPayload = Omit<
    WikiPageTagPayload,
    "id" | "publicId" | "color"
> & {
    publicId: WikiPageTagPublicId;
    color: ColorPaletteEntry | null;
};

export const WikiPageTagNaturalOrderBy: Prisma.WikiPageTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
];

//////////////////////////////////////////////////////////////
export const WikiPageTagAssignmentArgs = Prisma.validator<Prisma.WikiPageTagAssignmentDefaultArgs>()({
    include: {
        tag: true,
    }
});
export type WikiPageTagAssignmentPayload = Prisma.WikiPageTagAssignmentGetPayload<typeof WikiPageTagAssignmentArgs>;
export type WikiPageTagAssignmentClientPayload = Omit<
    WikiPageTagAssignmentPayload,
    "id" | "publicId" | "tagId" | "tag"
> & {
    publicId: WikiPageTagAssignmentPublicId;
    tagId: WikiPageTagPublicId;
    tag: WikiPageTagClientPayload;
};

export const WikiPageTagAssignmentNaturalOrderBy: Prisma.WikiPageTagAssignmentOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'asc' } },
    { tag: { text: 'asc' } },
];

export const FileArgs = Prisma.validator<Prisma.FileArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        uploadedByUser: true,

        tags: FileTagAssignmentArgs,
        taggedUsers: FileUserTagArgs,
        taggedSongs: FileSongTagArgs,
        taggedEvents: FileEventTagArgs,
        taggedInstruments: FileInstrumentTagArgs,
        taggedWikiPages: FileWikiPageTagArgs,

        parentFile: true,
        childFiles: true,
        frontpageGalleryItems: true,
        pinnedForSongs: true,
        previewFile: true,
        previewForFile: true,
    }
});

export type FilePayload = Prisma.FileGetPayload<typeof FileArgs>;
export type FilePayloadMinimum = Prisma.FileGetPayload<{}>;

export const FileNaturalOrderBy: Prisma.FileOrderByWithRelationInput[] = [
    { uploadedAt: 'desc' }
];


////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////
export const EventStatusArgs = Prisma.validator<Prisma.EventStatusArgs>()({
    include: {
        // including only in order to get a count.
        events: {
            select: {
                id: true,
                name: true,
            }
        },
    }
});

export type EventStatusPayload = Prisma.EventStatusGetPayload<typeof EventStatusArgs>;

export type EventStatusPayloadMinimum = Prisma.EventStatusGetPayload<{}>;

export const EventStatusNaturalOrderBy: Prisma.EventStatusOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { label: 'asc' },
    { id: 'asc' },
];



export const EventTagArgs = Prisma.validator<Prisma.EventTagArgs>()({
    include: {
        events: true,
    }
});

export type EventTagPayload = Prisma.EventTagGetPayload<typeof EventTagArgs>;

export const EventTagNaturalOrderBy: Prisma.EventTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];





export const EventAttendanceArgs = Prisma.validator<Prisma.EventAttendanceArgs>()({
    include: {
        responses: true,
    }
});

export type EventAttendancePayload = Prisma.EventAttendanceGetPayload<typeof EventAttendanceArgs>;

// when you don't need responses just use this
export type EventAttendanceBasePayload = Prisma.EventAttendanceGetPayload<{}>;

export const EventAttendanceNaturalOrderBy: Prisma.EventAttendanceOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////

export const EventSegmentBehavior = {
    Sets: "Sets",
    Options: "Options",
} as const satisfies Record<string, string>;


////////////////////////////////////////////////////////////////
export const FrontpageGalleryItemArgs = Prisma.validator<Prisma.FrontpageGalleryItemArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        file: {
            include: {
                visiblePermission: {
                    include: {
                        roles: true
                    }
                },
                parentFile: true,
            }
        },
    },
});
export type FrontpageGalleryItemPayload = Prisma.FrontpageGalleryItemGetPayload<typeof FrontpageGalleryItemArgs>;
export type FrontpageGalleryItemPayloadMinimum = Prisma.FrontpageGalleryItemGetPayload<{}>;


export const FrontpageGalleryItemNaturalOrderBy: Prisma.FrontpageGalleryItemOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];






export type DashboardDynMenuLink = Prisma.MenuLinkGetPayload<{ include: { createdByUser, visiblePermission } }>;

export interface ObjectWithVisiblePermission {
    visiblePermissionId: PermissionPublicId | null;
};

export const ChangeArgs = Prisma.validator<Prisma.ChangeDefaultArgs>()({
    include: {
        user: true,
    }
});

export type ChangePayload = Prisma.ChangeGetPayload<typeof ChangeArgs>;

export const ChangeNaturalOrderBy: Prisma.ChangeOrderByWithRelationInput[] = [
    { changedAt: 'desc' },
];

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:3-29
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 22a1fe5f4db6256e1c8b783989dee84d2b17cfe6580903c0cf0d77ba90bd73f6
// MIGRATION_REFERENCE_BEGIN
// import type {
//     EventAttendancePublicId,
//     EventPublicId,
//     EventSegmentPublicId,
//     EventSegmentUserResponsePublicId,
//     EventStatusPublicId,
//     EventTagAssignmentPublicId,
//     EventTagPublicId,
//     EventTypePublicId,
//     EventUserResponsePublicId,
//     FilePublicId,
//     FileTagPublicId,
//     InstrumentFunctionalGroupPublicId,
//     InstrumentPublicId,
//     PermissionPublicId,
//     RolePermissionPublicId,
//     RolePublicId,
//     SongPublicId,
//     SongTagAssociationPublicId,
//     SongTagPublicId,
//     UserInstrumentPublicId,
//     UserPublicId,
//     UserTagAssignmentPublicId,
//     UserTagPublicId,
//     WikiPageTagAssignmentPublicId,
//     WikiPageTagPublicId,
// } from "shared/publicId";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:147-151
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: f35a55a84a92de9ef1fcd35e0c5041609461e5071223b7d4188d42356f31817e
// MIGRATION_REFERENCE_BEGIN
// export const VisiblePermissionInclude = {
//     include: {
//         roles: true
//     }
// };
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:174-226
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: c27889a1f2a6edc6c4339f1795187e39deef3a4fc3d32bbbad3793a0b0c5bc33
// MIGRATION_REFERENCE_BEGIN
//     { name: 'asc' },
//     { id: 'asc' },
// ];
//
//
//
//
// export const RolePermissionArgs = Prisma.validator<Prisma.RolePermissionArgs>()({
//     include: {
//         permission: true,
//         role: true,
//     }
// });
//
// export type RolePermissionAssociationPayload = Prisma.RolePermissionGetPayload<typeof RolePermissionArgs>;
//
// export const RolePermissionNaturalOrderBy: Prisma.RolePermissionOrderByWithRelationInput[] = [
//     { permission: { sortOrder: 'asc' } },
//     { permission: { name: 'asc' } },
//     { permission: { id: 'asc' } },
// ];
//
//
//
// export const RoleArgs = Prisma.validator<Prisma.RoleArgs>()({
//     include: {
//         permissions: {
//             include: {
//                 permission: true,
//             },
//             orderBy: RolePermissionNaturalOrderBy,
//         },
//     }
// });
//
// export type RolePayload = Prisma.RoleGetPayload<typeof RoleArgs>;
//
// export const RoleNaturalOrderBy: Prisma.RoleOrderByWithRelationInput[] = [
//     { sortOrder: 'asc' },
//     { name: 'asc' },
//     { id: 'asc' },
// ];
//
//
//
//
//
//
//
//
// ////////////////////////////////////////////////////////////////
// export const SongTagArgs = Prisma.validator<Prisma.SongTagArgs>()({
//     include: {
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:392-423
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: a4f2ff43a2510b89e122d018ced433d5bf944812d3f870cb7a55759f598d3c38
// MIGRATION_REFERENCE_BEGIN
// export type RoleClientPayload = Omit<Prisma.RoleGetPayload<{}>, "id" | "publicId"> & {
//     publicId: RolePublicId;
// };
//
// export type RolePermissionClientPayload = Omit<
//     Prisma.RolePermissionGetPayload<{}>,
//     "id" | "publicId" | "roleId" | "permissionId"
// > & {
//     publicId: RolePermissionPublicId;
//     roleId: RolePublicId;
//     permissionId: PermissionPublicId;
// };
//
// export type RoleWithPermissionsClientPayload = Omit<
//     RolePayload,
//     "id" | "publicId" | "permissions"
// > & {
//     publicId: RolePublicId;
//     permissions: Array<Omit<
//         RolePayload["permissions"][number],
//         "id" | "publicId" | "roleId" | "permissionId" | "permission"
//     > & {
//         publicId: RolePermissionPublicId;
//         roleId?: RolePublicId;
//         permissionId: PermissionPublicId;
//         permission: PermissionClientPayload;
//     }>;
// };
//
// type UserInstrumentReferenceDbPayload = Prisma.UserInstrumentGetPayload<
//     typeof UserInstrumentReferenceArgs
// >;
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:467-501
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 4f37cb4b158dbdb6df8d2279c2de16f0aecc9ddb54e77d9b01c02f002b881be9
// MIGRATION_REFERENCE_BEGIN
// export const UserArgs = Prisma.validator<Prisma.UserArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         roleId: true,
//         cssClass: true,
//         // Explicitly exclude: hashedPassword, signInMethods, calendarFeedToken, uid
//         role: {
//             include: {
//                 permissions: {
//                     include: {
//                         permission: true,
//                     }
//                 },
//             }
//         },
//         instruments: UserInstrumentArgs,
//         tags: {
//             include: {
//                 userTag: true,
//             },
//             orderBy: {
//                 userTag: {
//                     sortOrder: 'asc'
//                 }
//             }
//         },
//     }
// });
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:519-604
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 92efd85a3e8e83b82b19867d7337df59dd85f723d7afe5986c3b6fb75ddb6d7a
// MIGRATION_REFERENCE_BEGIN
// export type UserClientPayload = Omit<
//     UserPayload,
//     "id" | "publicId" | "instruments" | "tags" | "roleId" | "role"
// > & {
//     publicId: UserPublicId;
//     roleId: RolePublicId | null;
//     role: RoleWithPermissionsClientPayload | null;
//     instruments: UserInstrumentClientPayload[];
//     tags: UserTagAssignmentClientPayload[];
// };
//
// // Generic user queries must not expose role grants. Server authorization code
// // uses UserArgs/UserWithRolesArgs when it needs the permission composition.
// export const UserSafeArgs = Prisma.validator<Prisma.UserArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         roleId: true,
//         cssClass: true,
//         role: true,
//         instruments: UserInstrumentArgs,
//         tags: {
//             include: {
//                 userTag: true,
//             },
//             orderBy: {
//                 userTag: {
//                     sortOrder: 'asc'
//                 }
//             }
//         },
//     },
// });
//
// export const UserMinimumArgs = Prisma.validator<Prisma.UserArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         roleId: true,
//         cssClass: true,
//         // Explicitly exclude: hashedPassword, signInMethods, calendarFeedToken, uid
//     }
// });
// type UserPayloadMinimumDb = Prisma.UserGetPayload<typeof UserMinimumArgs>;
// export type UserPayloadMinimum = Omit<UserPayloadMinimumDb, "id" | "publicId" | "roleId"> & {
//     publicId: UserPublicId;
//     roleId: RolePublicId | null;
// };
//
//
// export const UserForCalBackendArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         roleId: true,
//         cssClass: true,
//         uid: true,
//         role: {
//             include: {
//                 permissions: {
//                     include: {
//                         permission: true,
//                     }
//                 },
//             }
//         }
//     }
// });
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/prismArgs.ts:608-635
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 4999318716a614e613a562c74aa07d89b879dea457a97c9cb126387cd50e8998
// MIGRATION_REFERENCE_BEGIN
// export const UserWithInstrumentsArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         roleId: true,
//         cssClass: true,
//
//         instruments: UserInstrumentReferenceArgs,
//         tags: UserTagAssignmentReferenceArgs,
//     }
// });
//
// export type UserWithInstrumentsDbPayload = Prisma.UserGetPayload<typeof UserWithInstrumentsArgs>;
// export type UserWithInstrumentsClientPayload = Omit<
//     UserWithInstrumentsDbPayload,
//     "id" | "publicId" | "instruments" | "tags" | "roleId"
// > & {
//     publicId: UserPublicId;
//     roleId: RolePublicId | null;
//     instruments: UserInstrumentReferenceClientPayload[];
//     tags: UserTagAssignmentReferenceClientPayload[];
// };
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/core/db3/shared/schema/prismArgs.ts:302-326
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: fa214cc999470349d1a35c227447b93a83038dbb421a5aeef085c9b8d1abb26c
// MIGRATION_REFERENCE_BEGIN
// export const UserInstrumentArgs = Prisma.validator<Prisma.UserInstrumentArgs>()({
//     include: {
//         instrument: InstrumentArgs,
//         //user: true,
//     }
// });
//
// export type UserInstrumentPayload = Prisma.UserInstrumentGetPayload<typeof UserInstrumentArgs>;
//
// export type UserInstrumentClientPayload = Omit<
//     UserInstrumentPayload,
//     "id" | "publicId" | "userId" | "instrumentId" | "instrument"
// > & {
//     publicId: UserInstrumentPublicId;
//     userId: UserPublicId;
//     instrumentId: InstrumentPublicId;
//     instrument: InstrumentClientPayload;
// };
//
// export const UserInstrumentNaturalOrderBy: Prisma.UserInstrumentOrderByWithRelationInput[] = [
//     { instrument: { sortOrder: 'asc' } },
//     { instrument: { name: 'asc' } },
//     { instrument: { id: 'asc' } },
// ];
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/core/db3/shared/schema/prismArgs.ts:391-466
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 93f76602a315831647e0ec88ec448f7298cf43a8a03b9579c9e666e105d96a12
// MIGRATION_REFERENCE_BEGIN
// export const UserArgs = Prisma.validator<Prisma.UserArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         cssClass: true,
//         // Explicitly exclude: hashedPassword, signInMethods, calendarFeedToken, uid
//         instruments: UserInstrumentArgs,
//         tags: {
//             include: {
//                 userTag: true,
//             },
//             orderBy: {
//                 userTag: {
//                     sortOrder: 'asc'
//                 }
//             }
//         },
//     }
// });
//
// export type UserPayload = Prisma.UserGetPayload<typeof UserArgs>;
// export type UserTagClientPayload = Omit<
//     UserPayload["tags"][number]["userTag"],
//     "id" | "publicId"
// > & {
//     publicId: UserTagPublicId;
// };
// export type UserTagAssignmentClientPayload = Omit<
//     UserPayload["tags"][number],
//     "id" | "publicId" | "userId" | "userTagId" | "userTag"
// > & {
//     publicId: UserTagAssignmentPublicId;
//     userId: UserPublicId;
//     userTagId: UserTagPublicId;
//     userTag: UserTagClientPayload;
// };
// export type UserClientPayload = Omit<
//     UserPayload,
//     "id" | "publicId" | "instruments" | "tags"
// > & {
//     publicId: UserPublicId;
//     instruments: UserInstrumentClientPayload[];
//     tags: UserTagAssignmentClientPayload[];
// };
//
// // Generic account queries do not expose role grants. Authorization uses UserWithRolesArgs.
// export const UserSafeArgs = Prisma.validator<Prisma.UserArgs>()({
//     select: {
//         id: true,
//         publicId: true,
//         name: true,
//         isSysAdmin: true,
//         isDeleted: true,
//         email: true,
//         phone: true,
//         createdAt: true,
//         cssClass: true,
//         instruments: UserInstrumentArgs,
//         tags: {
//             include: {
//                 userTag: true,
//             },
//             orderBy: {
//                 userTag: {
//                     sortOrder: 'asc'
//                 }
//             }
//         },
//     },
// });
// MIGRATION_REFERENCE_END
