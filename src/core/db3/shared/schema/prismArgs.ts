import { Prisma } from "db";
import type {
    BandUserPublicId,
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
    InstrumentPublicId,
    PermissionPublicId,
    SongPublicId,
    SongTagAssociationPublicId,
    SongTagPublicId,
    UserPublicId,
} from "shared/publicId";
//import * as db3 from "../db3core"; // circular
import { AuxUserArgs } from "types";
import { bandEventTagSelection } from "../entities/event/eventTagCatalogs";
import { bandWikiPageTagSelection } from "../entities/wikiPageTag/wikiPageTagViews";
import type { bandSongTagDisplayContract } from "../entities/song/bandSongTagViews";
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
export const SongTagArgs = Prisma.validator<Prisma.BandSongTagDefaultArgs>()({
    include: {
        songs: true,
        name: true,
        description: true,
        globalSongTag: true,
    }
});

export type SongTagPayload = Prisma.BandSongTagGetPayload<typeof SongTagArgs>;

// Localized label ordering belongs to the resolved catalog; database ties stay stable.
export const SongTagNaturalOrderBy: Prisma.BandSongTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];
export const SongTagAssociationArgs = Prisma.validator<Prisma.BandSongTagAssociationDefaultArgs>()({
    include: {
        song: true,
        tag: {
            include: {
                name: true,
                description: true,
                globalSongTag: true
            }
        },
    },
});

export type SongTagAssociationPayload = Prisma.BandSongTagAssociationGetPayload<typeof SongTagAssociationArgs>;

export type SongTagClientPayload = ReturnType<typeof bandSongTagDisplayContract.hydrate>;

export type SongTagAssociationClientPayload = Omit<
    Prisma.BandSongTagAssociationGetPayload<{ include: { tag: true } }>,
    "id" | "publicId" | "songId" | "bandSongTagId" | "tag"
> & {
    publicId: SongTagAssociationPublicId;
    songId: SongPublicId;
    bandSongTagId: SongTagPublicId;
    tag: SongTagClientPayload;
};

export type SongTagAssociationReferenceClientPayload = Pick<
    SongTagAssociationClientPayload,
    "publicId" | "songId" | "bandSongTagId"
>;

// Display views sort by resolved tag order after hydration, including inherited values.
export const SongTagAssociationNaturalOrderBy: Prisma.BandSongTagAssociationOrderByWithRelationInput[] = [
    { publicId: 'asc' },
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











type PermissionForVisibilityDbPayload = Prisma.PermissionGetPayload<typeof PermissionForVisibilityArgs>;
export type PermissionForVisibilityPayload = Omit<PermissionForVisibilityDbPayload, "publicId" | "description"> & {
    publicId: PermissionPublicId;
    description: string | null;
};

export type PermissionClientPayload = Omit<Prisma.PermissionGetPayload<{}>, "id" | "publicId"> & {
    publicId: PermissionPublicId;
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




export const UserNaturalOrderBy: Prisma.UserOrderByWithRelationInput[] = [
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
        eventTag: { select: { ...bandEventTagSelection.select, bandId: true } },
    }
});
export type EventTagAssignmentPayload = Prisma.EventTagAssignmentGetPayload<typeof EventTagAssignmentArgs>;


export const EventTagAssignmentNaturalOrderBy: Prisma.EventTagAssignmentOrderByWithRelationInput[] = [
    { eventTag: { sortOrder: 'asc' } },
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
        visiblePermission: true,
    }
}>;

export const EventArgs = Prisma.validator<Prisma.EventArgs>()({
    include: {
        visiblePermission: true,
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
                bandInstrument: true,
                bandUser: { include: { user: true } },
            }
        },
        segments: {
            orderBy: { startsAt: "desc" },
            include: {
                responses: {
                    include: {
                        bandUser: { include: { user: true } },
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
    "id" | "publicId" | "eventId" | "bandEventTagId"
> & {
    publicId: EventTagAssignmentPublicId;
    eventId: EventPublicId;
    bandEventTagId: EventTagPublicId;
};


////////////////////////////////////////////////////////////////
export const EventUserResponseArgs = Prisma.validator<Prisma.EventUserResponseArgs>()({
    include: {
        bandInstrument: {
            select: {
                publicId: true
            }
        },
        bandUser: {
            select: {
                publicId: true,
                userId: true,
                user: {
                    select: {
                        publicId: true,
                        name: true
                    }
                }
            }
        },
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
        bandUser: { select: { publicId: true, userId: true, user: { select: { publicId: true, name: true } } } },
    }
});

export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<{
    include: typeof EventSegmentUserResponseArgs.include
}>;

export type EventSegmentUserResponseClientPayload = Omit<
    Prisma.EventSegmentUserResponseGetPayload<{}>, "id" | "publicId" | "eventSegmentId" | "attendanceId" | "bandUserId" | "createdByUserId" | "updatedByUserId"
> & {
    publicId: EventSegmentUserResponsePublicId;
    eventSegmentId: EventSegmentPublicId;
    attendanceId: EventAttendancePublicId | null;
    bandUserId: BandUserPublicId;
    createdByUserId: UserPublicId | null;
    updatedByUserId: UserPublicId | null;
};
export type EventUserResponseClientPayload = Omit<
    Prisma.EventUserResponseGetPayload<{}>, "id" | "publicId" | "eventId" | "bandInstrumentId" | "bandUserId"
> & {
    publicId: EventUserResponsePublicId;
    eventId: EventPublicId;
    bandInstrumentId: InstrumentPublicId | null;
    bandUserId: BandUserPublicId;
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
////////////////////////////////////////////////////////////////
export const BandFileTagAssignmentArgs = Prisma.validator<Prisma.BandFileTagAssignmentDefaultArgs>()({
    include: {
        file: true,
        bandFileTag: { include: { name: true, description: true, globalFileTag: true } },
    }
});
export type BandFileTagAssignmentPayload = Prisma.BandFileTagAssignmentGetPayload<typeof BandFileTagAssignmentArgs>;

export const BandFileTagAssignmentNaturalOrderBy: Prisma.BandFileTagAssignmentOrderByWithRelationInput[] = [
    { bandFileTag: { sortOrder: 'asc' } },
    { publicId: 'asc' },
];




////////////////////////////////////////////////////////////////
export const FileUserTagArgs = Prisma.validator<Prisma.FileUserTagArgs>()({
    include: {
        file: true,
        bandUser: { include: { user: true } },
    }
});
export type FileUserTagPayload = Prisma.FileUserTagGetPayload<typeof FileUserTagArgs>;
export const FileUserTagNaturalOrderBy: Prisma.FileUserTagOrderByWithRelationInput[] = [
    { bandUser: { user: { name: 'asc' } } },
    { publicId: 'asc' },
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
            include: { visiblePermission: true }
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
            include: { visiblePermission: true }
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
        bandInstrument: { select: { publicId: true, name: true } },
    }
});
export type FileInstrumentTagPayload = Prisma.FileInstrumentTagGetPayload<typeof FileInstrumentTagArgs>;
export type FileInstrumentTagPayloadWithBandInstrument = Prisma.FileInstrumentTagGetPayload<{
    include: {
        bandInstrument: true,
    }
}>;

export const FileInstrumentTagNaturalOrderBy: Prisma.FileInstrumentTagOrderByWithRelationInput[] = [
    // Resolved instrument labels belong to the band catalog, not raw SQL ordering.
    { publicId: 'asc' },
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
export const WikiPageTagAssignmentArgs = Prisma.validator<Prisma.WikiPageTagAssignmentDefaultArgs>()({
    include: { tag: bandWikiPageTagSelection },
});
export type WikiPageTagAssignmentPayload = Prisma.WikiPageTagAssignmentGetPayload<typeof WikiPageTagAssignmentArgs>;

// Fetch associations stably; consumers order their hydrated, localized tag values.
export const WikiPageTagAssignmentNaturalOrderBy: Prisma.WikiPageTagAssignmentOrderByWithRelationInput[] = [
    { publicId: "asc" },
];

export const FileArgs = Prisma.validator<Prisma.FileArgs>()({
    include: {
        visiblePermission: true,
        uploadedByUser: true,

        tags: BandFileTagAssignmentArgs,
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
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
export const FrontpageGalleryItemArgs = Prisma.validator<Prisma.FrontpageGalleryItemArgs>()({
    include: {
        visiblePermission: true,
        file: {
            include: {
                visiblePermission: true,
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





// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:src/core/db3/shared/schema/prismArgs.ts:1135-1146
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 4406beff321c7c32c061980f4f6bd116b64a603e0e428ffc3ac7f3732c131862
// MIGRATION_REFERENCE_BEGIN
// export const ChangeArgs = Prisma.validator<Prisma.ChangeDefaultArgs>()({
//     include: {
//         user: true,
//     }
// });
//
// export type ChangePayload = Prisma.ChangeGetPayload<typeof ChangeArgs>;
//
// export const ChangeNaturalOrderBy: Prisma.ChangeOrderByWithRelationInput[] = [
//     { changedAt: 'desc' },
// ];
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-search
// Source: 3eef35e286d02c61aebd0bb000c433c34cfb15a6:src/core/db3/shared/schema/prismArgs.ts:963-966
// Reason: Raw File tag and instrument name matching cannot query the new localized catalogs safely.
// Restore: Restore File quick filtering and association name ordering against resolved band tag and instrument labels, preserving blanks, hidden assignments, visibility and pagination.
// Verification: Test localized names, intentional blanks, hidden assigned tags, cross-band visibility, pagination and the built File search.
// SHA256: b998a780e5c6f49ff142aba85fdf3aa5ac5805fc37d469039e27a52e79f2e71c
// MIGRATION_REFERENCE_BEGIN
// export const FileInstrumentTagNaturalOrderBy: Prisma.FileInstrumentTagOrderByWithRelationInput[] = [
//     { instrument: { name: 'asc' } },
//     { instrument: { id: 'asc' } },
// ];
// MIGRATION_REFERENCE_END
