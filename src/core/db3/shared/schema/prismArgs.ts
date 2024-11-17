import { z } from "zod";
import db, { Prisma } from "db";
//import * as db3 from "../db3core"; // circular
import { CMDBTableFilterModel, ImageEditParams, MakeDefaultImageEditParams, TAnyModel, parsePayloadJSON } from "../apiTypes";
import { TableAccessor } from "shared/rootroot";
import { ServerStartInfo } from "shared/serverStateBase";
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

export const EventTagSignificance = {
    Majoretteketet: "Majoretteketet",
    TownHall: "TownHall",
} as const satisfies Record<string, string>;

export const FileTagSignificance = {
    Partition: "Partition",
    Recording: "Recording",
    Rider: "Rider",
} as const satisfies Record<string, string>;

export const UserTagSignificance = {
    General: "General",
    DefaultInvitation: "DefaultInvitation",
} as const satisfies Record<string, string>;

export const PermissionSignificance = {
    General: "General",
    Visibility_Public: "Visibility_Public",
    Visibility_LoggedInUsers: "Visibility_LoggedInUsers",
    Visibility_Members: "Visibility_Members",
    Visibility_Editors: "Visibility_Editors",
} as const satisfies Record<string, string>;

export const RoleSignificance = {
    General: "General",
} as const satisfies Record<string, string>;

export const SongCreditTypeSignificance = {
    Composer: "Composer",
    Arranger: "Arranger",
} as const satisfies Record<string, string>;

export const SongTagSignificance = {
    Improvisation: "Improvisation",
    VocalSolo: "VocalSolo",
    ByHeart: "ByHeart",
    Street: "Street",
    Majoretteketet: "Majoretteketet",
} as const satisfies Record<string, string>;

// https://stackoverflow.com/questions/76518631/typescript-return-the-enum-values-in-parameter-using-a-generic-enum-type-method
// interesting that const objects are preferred over enums. but yea for populating datagrid single select options i agree.
export const InstrumentTagSignificance = {
    NeedsPower: "NeedsPower",
} as const satisfies Record<string, string>;




////////////////////////////////////////////////////////////////
export const VisiblePermissionInclude = {
    include: {
        roles: true
    }
};

export const PermissionArgs = Prisma.validator<Prisma.PermissionArgs>()({
    include: {
        roles: true,
    }
});
export type PermissionPayloadMinimum = Prisma.PermissionGetPayload<{}>;
export type PermissionPayload = Prisma.PermissionGetPayload<typeof PermissionArgs>;

export const PermissionNaturalOrderBy: Prisma.PermissionOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { name: 'asc' },
    { id: 'asc' },
];




export const RolePermissionArgs = Prisma.validator<Prisma.RolePermissionArgs>()({
    include: {
        permission: true,
        role: true,
    }
});

export type RolePermissionAssociationPayload = Prisma.RolePermissionGetPayload<typeof RolePermissionArgs>;

export const RolePermissionNaturalOrderBy: Prisma.RolePermissionOrderByWithRelationInput[] = [
    { permission: { sortOrder: 'asc' } },
    { permission: { name: 'asc' } },
    { permission: { id: 'asc' } },
];



export const RoleArgs = Prisma.validator<Prisma.RoleArgs>()({
    include: {
        permissions: {
            include: {
                permission: true,
            },
            orderBy: RolePermissionNaturalOrderBy,
        },
    }
});

export type RolePayload = Prisma.RoleGetPayload<typeof RoleArgs>;

export const RoleNaturalOrderBy: Prisma.RoleOrderByWithRelationInput[] = [
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











export const InstrumentTagAssociationArgs = Prisma.validator<Prisma.InstrumentTagAssociationArgs>()({
    include: {
        instrument: true,
        tag: true,
    }
});

export type InstrumentTagAssociationPayload = Prisma.InstrumentTagAssociationGetPayload<typeof InstrumentTagAssociationArgs>;

export const InstrumentTagAssociationNaturalOrderBy: Prisma.InstrumentTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'asc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];



export const InstrumentArgs = Prisma.validator<Prisma.InstrumentArgs>()({
    include: {
        functionalGroup: true,
        instrumentTags: {
            include: {
                tag: true,
            },
            orderBy: InstrumentTagAssociationNaturalOrderBy
        }
    }
});

export type InstrumentPayload = Prisma.InstrumentGetPayload<typeof InstrumentArgs>;


////////////////////////////////////////////////////////////////
export const InstrumentMinimumArgs = Prisma.validator<Prisma.InstrumentArgs>()({
});

export type InstrumentPayloadMinimum = Prisma.InstrumentGetPayload<typeof InstrumentMinimumArgs>;

export const UserInstrumentArgs = Prisma.validator<Prisma.UserInstrumentArgs>()({
    include: {
        instrument: InstrumentArgs,
        //user: true,
    }
});

export type UserInstrumentPayload = Prisma.UserInstrumentGetPayload<typeof UserInstrumentArgs>;

export const UserInstrumentNaturalOrderBy: Prisma.UserInstrumentOrderByWithRelationInput[] = [
    { instrument: { sortOrder: 'asc' } },
    { instrument: { name: 'asc' } },
    { instrument: { id: 'asc' } },
];

export type UserPayload_Name = Prisma.UserGetPayload<{
    select: {
        name: true,
    }
}>;


export type UserMinimumPayload = Prisma.UserGetPayload<{}>;

export const UserArgs = Prisma.validator<Prisma.UserArgs>()({
    include: {
        role: {
            include: {
                permissions: {
                    include: {
                        permission: true,
                    }
                },
            }
        },
        instruments: UserInstrumentArgs,
        tags: {
            include: {
                userTag: true,
            },
            orderBy: {
                userTag: {
                    sortOrder: 'asc'
                }
            }
        },
    }
});

export type UserPayload = Prisma.UserGetPayload<typeof UserArgs>;
export type UserPayloadMinimum = Prisma.UserGetPayload<{}>;


export const UserWithInstrumentsArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: {
        instruments: true,
        tags: true,
    }
    // include: {
    //     //instruments: UserInstrumentArgs,
    //     instruments: {
    //         include: {
    //             instrument
    //         }
    //     }
    // }
});

export type UserWithInstrumentsPayload = Prisma.UserGetPayload<typeof UserWithInstrumentsArgs>;


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
        createdByUser: AuxUserArgs,
        visiblePermission: true,
        //     visiblePermission: {
        //         include: {
        //         roles: true
        //     }
        // },
        tags: true,
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
export type SongPayloadMinimum = Prisma.SongGetPayload<{}>;




////////////////////////////////////////////////////////////////
export const InstrumentFunctionalGroupArgs = Prisma.validator<Prisma.InstrumentFunctionalGroupArgs>()({
    include: {
        instruments: true,
    },
});

export type InstrumentFunctionalGroupPayload = Prisma.InstrumentFunctionalGroupGetPayload<typeof InstrumentFunctionalGroupArgs>;
export type InstrumentFunctionalGroupPayloadMinimum = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

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
export const FileWithTagsArgs = Prisma.validator<Prisma.FileArgs>()({
    //export const FileWithTagsArgs: Prisma.FileArgs = {
    include: {
        //visiblePermission: VisiblePermissionInclude,
        uploadedByUser: { select: UserMinimalSelect },
        tags: true,
        // {
        //     include: {
        //         fileTag: true,
        //     },
        //     orderBy: {
        //         fileTag: {
        //             sortOrder: 'asc'
        //         }
        //     }
        // },
        taggedEvents: {
            include: {
                event: true,
            }
        },
        taggedInstruments: true,
        taggedSongs: {
            include: {
                song: true,
            }
        },
        taggedUsers: {
            include: {
                user: {
                    select: UserMinimalSelect,
                },
            }
        },
    },
}
);
export type FileWithTagsPayload = Prisma.FileGetPayload<typeof FileWithTagsArgs>;





////////////////////////////////////////////////////////////////
// for full song page display.

export const SongCreditArgsFromSong = Prisma.validator<Prisma.SongCreditDefaultArgs>()({
    include: {
        user: true
    }
});

export const SongArgs_Verbose = Prisma.validator<Prisma.SongDefaultArgs>()({
    include: {
        //visiblePermission: VisiblePermissionInclude,
        createdByUser: AuxUserArgs,
        tags: true,
        // {
        //     include: {
        //         tag: true, // include foreign object
        //     },
        //     orderBy: SongTagAssociationNaturalOrderBy,
        // },
        taggedFiles: {
            include: {
                file: FileWithTagsArgs,
            },
            orderBy: { file: { uploadedAt: 'desc' } }
        },
        credits: SongCreditArgsFromSong,
        // comments
        // songLists   EventSongListSong[]
    }
});

export type SongPayload_Verbose = Prisma.SongGetPayload<typeof SongArgs_Verbose>;

export type SongCreditPayloadFromVerboseSong = Prisma.SongCreditGetPayload<typeof SongCreditArgsFromSong>;


export type SongTaggedFilesPayload = Prisma.FileSongTagGetPayload<{
    include: {
        file: typeof FileWithTagsArgs,
    }
}>;



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


////////////////////////////////////////////////////////////////

export const EventCustomFieldArgs = Prisma.validator<Prisma.EventCustomFieldDefaultArgs>()({
    include: {}
});
export type EventCustomFieldPayload = Prisma.EventCustomFieldGetPayload<typeof EventCustomFieldArgs>;


export const EventCustomFieldNaturalOrderBy: Prisma.EventCustomFieldOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];

export enum EventCustomFieldSignificance {
};

export enum EventCustomFieldDataType {
    Checkbox = "Checkbox",
    Options = "Options",
    RichText = "RichText",
    SimpleText = "SimpleText",
};

export type EventCustomFieldOption = {
    label: string,
    id: string,
    color?: string,
};

const EventCustomFieldOptionSchema = z.object({
    label: z.string(),
    id: z.string(),
    color: z.string().optional(), // Optional field
});

// Define the schema for an array of EventCustomFieldOption objects
export const EventCustomFieldOptionArraySchema = z.array(EventCustomFieldOptionSchema);

export type EventCustomFieldOptions = z.infer<typeof EventCustomFieldOptionArraySchema>;

export function ParseEventCustomFieldOptionsJson(optionsJson: string | null): EventCustomFieldOptions {
    try {
        const newobj = JSON.parse(optionsJson || "");
        const r = EventCustomFieldOptionArraySchema.parse(newobj);
        return r;
    }
    catch (e) {
        return [];
    }
}


////////////////////////////////////////////////////////////////

export const EventCustomFieldValueArgs = Prisma.validator<Prisma.EventCustomFieldValueDefaultArgs>()({
    include: {
        customField: true,
    }
});
export type EventCustomFieldValuePayload = Prisma.EventCustomFieldValueGetPayload<typeof EventCustomFieldValueArgs>;


export const EventCustomFieldValueNaturalOrderBy: Prisma.EventCustomFieldValueOrderByWithRelationInput[] = [
    { customField: { sortOrder: 'asc' } },
    { id: 'asc' },
];



////////////////////////////////////////////////////////////////
export type EventPayloadMinimum = Prisma.EventGetPayload<{}>;
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
        workflowDef: true,
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

export const EventSegmentUserResponseNaturalOrderBy: Prisma.EventSegmentUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];



////////////////////////////////////////////////////////////////
export const EventSegmentArgs = Prisma.validator<Prisma.EventSegmentArgs>()({
    //orderBy: { startsAt: "desc" },
    include: {
        event: true,
        responses: EventSegmentUserResponseArgs,
    }
});

export type EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

export type EventSegmentPayloadMinimum = Prisma.EventSegmentGetPayload<{}>;

export const EventSongListNaturalOrderBy: Prisma.EventSongListOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];

export const EventSongListArgs = Prisma.validator<Prisma.EventSongListArgs>()({
    include: {
        event: true,
        dividers: {
            include: {}
        },
        songs: {
            include: {
                song: SongArgs,
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

export function getCancelledStatusIds<T extends Prisma.EventStatusGetPayload<{ select: { id: true, significance: true } }>>(eventStatuses: T[]): number[] {
    return eventStatuses
        .filter(s => s.significance === EventStatusSignificance.Cancelled)
        .map(x => x.id);
}

export const compareEventSegments = (
    a: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, statusId: true } }>,
    b: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, statusId: true } }>,
    cancelledStatusIds: number[],
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




// all info that will appear on an event detail page
export const EventArgs_Verbose = Prisma.validator<Prisma.EventArgs>()({
    include: {
        status: true,
        //visiblePermission: VisiblePermissionInclude,
        createdByUser: AuxUserArgs,
        songLists: { ...EventSongListArgs, orderBy: EventSongListNaturalOrderBy },
        expectedAttendanceUserTag: {
            include: {
                userAssignments: true
            }
        },
        tags: true,
        // {
        //     orderBy: EventTagAssignmentNaturalOrderBy,
        //     include: {
        //         eventTag: true,
        //     }
        // },
        //type: true,
        //comments: EventCommentArgs,
        fileTags: {
            include: {
                file: FileWithTagsArgs,
            },
            orderBy: { file: { uploadedAt: 'desc' } }
        },
        segments: {
            orderBy: EventSegmentNaturalOrderBy,
            //include: EventSegmentArgs.include,
            include: {
                //event: true,
                responses: true,
            }

        },
        // responses: {
        //     include: EventUserResponseArgs.include,
        // }
        responses: true,
        workflowDef: true,
        customFieldValues: {
            // include: {
            //     customField: true,
            // },
            // include: {

            // }
            // orderBy: EventCustomFieldNaturalOrderBy,
        }
    }
});

export type EventVerbose_EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

export type EventClientPayload_Verbose = Prisma.EventGetPayload<typeof EventArgs_Verbose>;

export type EventVerbose_Event = Prisma.EventGetPayload<typeof EventArgs_Verbose>;
export type EventVerbose_EventUserResponse = Prisma.EventUserResponseGetPayload<typeof EventArgs_Verbose.include.responses>;
export type EventVerbose_EventSegment = Prisma.EventSegmentGetPayload<typeof EventArgs_Verbose.include.segments>;
export type EventVerbose_EventSegmentUserResponse = Prisma.EventSegmentUserResponseGetPayload<typeof EventArgs_Verbose.include.segments.include.responses>;



export type EventTaggedFilesPayload = Prisma.FileEventTagGetPayload<{
    include: {
        file: typeof FileWithTagsArgs,
    }
}>;




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
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
export const EventSongListSongArgs = Prisma.validator<Prisma.EventSongListSongArgs>()({
    include: {
        song: SongArgs,
    }
});

export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<typeof EventSongListSongArgs>;


////////////////////////////////////////////////////////////////
export const EventSongListDividerArgs = Prisma.validator<Prisma.EventSongListDividerDefaultArgs>()({
    include: {
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






export type EventPayloadClient = EventPayload; // used to include calculated fields

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
export type FileTagPayloadMinimum = Prisma.FileTagGetPayload<{}>;

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
        event: true,
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
        instrument: true,
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
    }
});

export type FilePayload = Prisma.FileGetPayload<typeof FileArgs>;
export type FilePayloadMinimum = Prisma.FileGetPayload<{}>;

export const FileNaturalOrderBy: Prisma.FileOrderByWithRelationInput[] = [
    { uploadedAt: 'desc' }
];


////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////
export const InstrumentTagArgs = Prisma.validator<Prisma.InstrumentTagArgs>()({
    include: {
        instruments: true,
    }
});

export type InstrumentTagPayload = Prisma.InstrumentTagGetPayload<typeof InstrumentTagArgs>;

export const InstrumentTagNaturalOrderBy: Prisma.InstrumentTagOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];
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
export type FrontpageGalleryItemPayloadForUpload = Prisma.FrontpageGalleryItemGetPayload<{
    include: { file: true }
}>;

// when editing files, we will graft the parent file onto the file. so create a type that can handle that grafting.
export const FrontpageGalleryItemArgsWithAncestorFile = Prisma.validator<Prisma.FrontpageGalleryItemDefaultArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        file: true,
    },
});
export type FrontpageGalleryItemPayloadWithAncestorFile = Prisma.FrontpageGalleryItemGetPayload<typeof FrontpageGalleryItemArgsWithAncestorFile>;


export const FrontpageGalleryItemNaturalOrderBy: Prisma.FrontpageGalleryItemOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];








export const ChangeArgs = Prisma.validator<Prisma.ChangeDefaultArgs>()({
    include: {
        user: true,
    }
});

export type ChangePayload = Prisma.ChangeGetPayload<typeof ChangeArgs>;

export const ChangeNaturalOrderBy: Prisma.ChangeOrderByWithRelationInput[] = [
    { changedAt: 'desc' },
];











// always returns valid
export const getGalleryItemDisplayParams = (f: Prisma.FrontpageGalleryItemGetPayload<{}>): ImageEditParams => {
    const ret = parsePayloadJSON<ImageEditParams>(f.displayParams, MakeDefaultImageEditParams, (e) => {
        console.log(`failed to parse gallery item display params for gallery item id ${f.id}, val:${f.displayParams}`);
    });
    // validate since this is coming from db.
    if (!ret.cropBegin) ret.cropBegin = { x: 0, y: 0 };
    if (!ret.rotate) ret.rotate = 0;
    if (!ret.cropSize) ret.cropSize = null;
    return ret;
};


////////////////////////////////////////////////////////////////


// generates 4 columns to link up this relationship:
// local tags field
// foreign tags field
export interface DefineManyToManyRelationshipArgs<TLocalPayload, TAssociationPayload, TForeignPayload> {
    // LOCAL
    localTableID: string; // "event"
    localColumnName: string; // "tags"

    local_getQuickFilterWhereClause?: (query: string) => TAnyModel; // basically this prevents the need to subclass and implement.
    local_getCustomFilterWhereClause?: (query: CMDBTableFilterModel) => TAnyModel;
    local_doesItemExactlyMatchText?: (item: TAssociationPayload, filterText: string) => boolean;

    // ASSOCIATION
    associationTableID: string; // "eventTagAssociation"
    associationLocalIDMember: string; // "eventID"
    associationLocalObjectMember: string; // "event"
    associationForeignIDMember: string; // eventTagID
    associationForeignObjectMember: string; // eventTag
    // when we get a list of tag options, they're foreign models (tags).
    // but we need our list to be association objects (itemTagAssocitaion)
    createMockAssociation?: (row: TAnyModel, item: TAnyModel) => TAssociationPayload;

    // FOREIGN
    foreignTableID: string; // "eventTag"
    foreignColumnName: string; // "events"

    foreign_getQuickFilterWhereClause?: (query: string) => TAnyModel; // basically this prevents the need to subclass and implement.
    foreign_getCustomFilterWhereClause?: (query: CMDBTableFilterModel) => TAnyModel;
    foreign_doesItemExactlyMatchText?: (item: TAssociationPayload, filterText: string) => boolean;
};

export const DefineManyToManyRelationship = <TLocalPayload, TAssociationPayload, TForeignPayload>(args: DefineManyToManyRelationshipArgs<TLocalPayload, TAssociationPayload, TForeignPayload>) => {

};



export interface ObjectWithVisiblePermission {
    visiblePermissionId: number | null;
};

export class DashboardContextDataBase {
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

    dynMenuLinks: TableAccessor<Prisma.MenuLinkGetPayload<{ include: { createdByUser } }>>;

    permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    role: TableAccessor<Prisma.RoleGetPayload<{}>>;
    rolePermission: TableAccessor<Prisma.RolePermissionGetPayload<{}>>;

    instrument: TableAccessor<EnrichedInstrument<Prisma.InstrumentGetPayload<{ include: { instrumentTags: true } }>>>;
    instrumentFunctionalGroup: TableAccessor<Prisma.InstrumentFunctionalGroupGetPayload<{}>>;

    currentUser: UserPayload | null;
    serverStartupState: ServerStartInfo;
}









export type EnrichInstrumentInput = Partial<Prisma.InstrumentGetPayload<{ include: { instrumentTags: true } }>>;
export type EnrichedInstrument<T extends EnrichInstrumentInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "functionalGroup"
    | "instrumentTags"
> & Prisma.InstrumentGetPayload<{
    select: { // must be select so we don't accidentally require all fields.
        functionalGroup: true,
        instrumentTags: {
            include: {
                tag: true,
            }
        },
    }
}>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichInstrument<T extends EnrichInstrumentInput>(
    item: T,
    data: DashboardContextDataBase,
): EnrichedInstrument<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        functionalGroup: data.instrumentFunctionalGroup.getById(item.functionalGroupId)!,
        instrumentTags: (item.instrumentTags || []).map((t) => {
            const ret: Prisma.InstrumentTagAssociationGetPayload<{ include: { tag: true } }> = {
                ...t,
                tag: data.instrumentTag.getById(t.tagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.tag.sortOrder - b.tag.sortOrder), // respect ordering
    };
}








export type EnrichSongInput = Partial<Prisma.SongGetPayload<{
    include: {
        tags: true,
    }
}>>;
export type EnrichedSong<T extends EnrichSongInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "tags"
    | "visiblePermission"
> & Prisma.SongGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
        tags: {
            include: { tag: true }
        },
    }
}>;


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSong<T extends EnrichSongInput>(
    item: T,
    data: DashboardContextDataBase,
): EnrichedSong<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.

    // here we could also drill in and enrich things like
    // - song credits
    // - files
    // and whatever else is there.

    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
        tags: (item.tags || []).map((t) => {
            const ret: Prisma.SongTagAssociationGetPayload<{ include: { tag: true } }> = {
                ...t,
                tag: data.songTag.getById(t.tagId)!, // enrich!
            };
            return ret;
        }).sort((a, b) => a.tag.sortOrder - b.tag.sortOrder), // respect ordering
    };
}









export type EnrichMenuLinkInput = Partial<Prisma.MenuLinkGetPayload<{
}>>;
export type EnrichedMenuLink<T extends EnrichMenuLinkInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
> & Prisma.MenuLinkGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
    }
}>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichMenuLink<T extends EnrichMenuLinkInput>(
    item: T,
    data: DashboardContextDataBase,
): EnrichedMenuLink<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
    };
}







export type EnrichFileInput = Partial<Prisma.FileGetPayload<{
    include: {
        tags: true,
        taggedInstruments: true,
    },
}>>;
export type EnrichedFile<T extends EnrichFileInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
    | "tags"
    | "taggedInstruments"
> & Prisma.FileGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
        tags: {
            include: {
                fileTag: true,
            }
        },
        taggedInstruments: {
            include: {
                instrument: true,
            }
        },
    }
}>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichFile<T extends EnrichFileInput>(
    item: T,
    data: DashboardContextDataBase,
): EnrichedFile<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
        taggedInstruments: (item.taggedInstruments || []).map((t) => {
            const ret: Prisma.FileInstrumentTagGetPayload<{ include: { instrument: true } }> = {
                ...t,
                instrument: data.instrument.getById(t.instrumentId)!, // enrich!
            };
            return ret;
        }),
        tags: (item.tags || []).map((t) => {
            const ret: Prisma.FileTagAssignmentGetPayload<{ include: { fileTag: true } }> = {
                ...t,
                fileTag: data.fileTag.getById(t.fileTagId)!, // enrich!
            };
            return ret;
        }),
    };
}












