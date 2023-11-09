import db, { Prisma } from "db";
import { TAnyModel } from "shared/utils";
import * as db3 from "../db3core";
import { ImageEditParams, MakeDefaultImageEditParams, parsePayloadJSON } from "../apiTypes";
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

export const EventStatusSignificance = {
    New: "New",
    Cancelled: "Cancelled",
    FinalConfirmation: "FinalConfirmation",
} as const satisfies Record<string, string>;

export const EventTagSignificance = {
    Majoretteketet: "Majoretteketet",
    TownHall: "TownHall",
} as const satisfies Record<string, string>;

export const FileTagSignificance = {
    Partition: "Partition",
    Recording: "Recording",
    Rider: "Rider",
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
    { sortOrder: 'desc' },
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
    { permission: { sortOrder: 'desc' } },
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
    { sortOrder: 'desc' },
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
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];
export const SongTagAssociationArgs = Prisma.validator<Prisma.SongTagAssociationArgs>()({
    include: {
        song: true,
        tag: true,
    }
});

export type SongTagAssociationPayload = Prisma.SongTagAssociationGetPayload<typeof SongTagAssociationArgs>;

export const SongTagAssociationNaturalOrderBy: Prisma.SongTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'desc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];

// export const SongCommentArgs = Prisma.validator<Prisma.SongCommentArgs>()({
//     include: {
//         song: true,
//         user: true,
//         visiblePermission: {
//             include: {
//                 roles: true
//             }
//         },
//     }
// });

// export type SongCommentPayload = Prisma.SongCommentGetPayload<typeof SongCommentArgs>;

// export const SongCommentNaturalOrderBy: Prisma.SongCommentOrderByWithRelationInput[] = [
//     { updatedAt: 'desc' },
//     { id: 'asc' },
// ];

export const SongCreditTypeArgs = Prisma.validator<Prisma.SongCreditTypeArgs>()({
    include: {
        songCredits: true,
    }
});

export type SongCreditTypePayload = Prisma.SongCreditTypeGetPayload<typeof SongCreditTypeArgs>;

export const SongCreditTypeNaturalOrderBy: Prisma.SongCreditTypeOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
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
    { tag: { sortOrder: 'desc' } },
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
    { instrument: { sortOrder: 'desc' } },
    { instrument: { name: 'asc' } },
    { instrument: { id: 'asc' } },
];

export type UserPayload_Name = Prisma.UserGetPayload<{
    select: {
        name: true,
        compactName: true,
    }
}>;


export type UserMinimumPayload = Prisma.UserGetPayload<{}>;

export const UserArgs = Prisma.validator<Prisma.UserArgs>()({
    include: {
        role: {
            include: {
                permissions: true,
            }
        },
        instruments: UserInstrumentArgs,
    }
});

export type UserPayload = Prisma.UserGetPayload<typeof UserArgs>;

export const UserNaturalOrderBy: Prisma.UserOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
];



// order by functional group, then by instrument.
export const InstrumentNaturalOrderBy: Prisma.InstrumentOrderByWithRelationInput[] = [
    {
        functionalGroup: {
            sortOrder: 'desc',
        }
    },
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];



////////////////////////////////////////////////////////////////
export const SongArgs = Prisma.validator<Prisma.SongArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        tags: {
            include: {
                tag: true, // include foreign object
            }
        },
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

export const InstrumentFunctionalGroupNaturalSortOrder: Prisma.InstrumentFunctionalGroupOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];






export const UserMinimalSelect = Prisma.validator<Prisma.UserSelect>()({
    name: true,
    compactName: true,
});

////////////////////////////////////////////////////////////////
export const FileWithTagsArgs = Prisma.validator<Prisma.FileArgs>()({
    //export const FileWithTagsArgs: Prisma.FileArgs = {
    include: {
        visiblePermission: VisiblePermissionInclude,
        tags: {
            include: {
                fileTag: true,
            }
        },
        taggedEvents: {
            include: {
                event: {
                    include: {
                        visiblePermission: VisiblePermissionInclude,
                    }
                }
            }
        },
        taggedInstruments: {
            include: {
                instrument: InstrumentArgs,
            }
        },
        taggedSongs: {
            include: {
                song: {
                    include: {
                        visiblePermission: VisiblePermissionInclude,
                    }
                }
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


export const EventTagAssignmentArgs = Prisma.validator<Prisma.EventTagAssignmentArgs>()({
    include: {
        event: true,
        eventTag: true,
    }
});
export type EventTagAssignmentPayload = Prisma.EventTagAssignmentGetPayload<typeof EventTagAssignmentArgs>;


export const EventTagAssignmentNaturalOrderBy: Prisma.EventTagAssignmentOrderByWithRelationInput[] = [
    { eventTag: { sortOrder: 'desc' } },
    { eventTag: { text: 'asc' } },
    { eventTag: { id: 'asc' } },
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
        createdByUser: true,
        status: true,
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            }
        },
        type: true,
        segments: {
            orderBy: { startsAt: "desc" },
            include: {
                responses: {
                    include: {
                        instrument: true,
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
export const EventSegmentUserResponseArgs = Prisma.validator<Prisma.EventSegmentUserResponseArgs>()({
    include: {
        attendance: true,
        eventSegment: true,
        instrument: InstrumentArgs,
        user: UserArgs
    }
});

export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<{
    include: typeof EventSegmentUserResponseArgs.include
}>;

export const EventSegmentArgs = Prisma.validator<Prisma.EventSegmentArgs>()({
    //orderBy: { startsAt: "desc" },
    include: {
        event: true,
        responses: EventSegmentUserResponseArgs,
    }
});

export type EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

// ////////////////////////////////////////////////////////////////
// export const EventCommentArgs = Prisma.validator<Prisma.EventCommentArgs>()({
//     include: {
//         event: true,
//         user: true,
//         visiblePermission: {
//             include: {
//                 roles: true
//             }
//         },
//     }
// });

// export type EventCommentPayload = Prisma.EventCommentGetPayload<typeof EventCommentArgs>;



export const EventSongListArgs = Prisma.validator<Prisma.EventSongListArgs>()({
    include: {
        event: true,
        visiblePermission: {
            include: {
                roles: true
            }
        },
        songs: {
            include: {
                song: SongArgs,
            }
        }
    },
});

export type EventSongListPayload = Prisma.EventSongListGetPayload<typeof EventSongListArgs>;

export const EventSongListNaturalOrderBy: Prisma.EventSongListOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { id: 'asc' },
];


export const EventSegmentNaturalOrderBy: Prisma.EventSegmentOrderByWithRelationInput[] = [
    { startsAt: "asc" },
    { id: "asc" },
];



// all info that will appear on an event detail page
export const EventArgs_Verbose = Prisma.validator<Prisma.EventArgs>()({
    include: {
        status: true,
        visiblePermission: VisiblePermissionInclude,
        createdByUser: true,
        songLists: EventSongListArgs,
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            }
        },
        type: true,
        //comments: EventCommentArgs,
        fileTags: {
            include: {
                file: FileWithTagsArgs,
            },
            orderBy: { file: { uploadedAt: 'desc' } }
        },
        segments: {
            orderBy: EventSegmentNaturalOrderBy,
            include: EventSegmentArgs.include,
        },
    }
});

export type EventVerbose_EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

// export type EventVerbose_EventSegmentPayload = Prisma.EventSegmentGetPayload<{
//     include: {
//         responses: {
//             include: {
//                 attendance: true,
//                 user: true,
//                 instrument: typeof InstrumentArgs,
//             }
//         },
//     }
// }>;


export type EventClientPayload_Verbose = Prisma.EventGetPayload<typeof EventArgs_Verbose>;

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

export const EventSongListSongNaturalOrderBy: Prisma.EventSongListSongOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
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

export const EventTypeNaturalOrderBy: Prisma.EventTypeOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { text: 'asc' },
    { id: 'asc' },
];






export type EventPayloadClient = EventPayload; // used to include calculated fields

export const EventNaturalOrderBy: Prisma.EventOrderByWithRelationInput[] = [
    // while you can order by relation (ex orderByRelation): https://github.com/prisma/prisma/issues/5008
    // you can't do aggregations; for us sorting by soonest segment date would require a min() aggregation. https://stackoverflow.com/questions/67930989/prisma-order-by-relation-has-only-count-property-can-not-order-by-relation-fie
    { id: 'desc' }, // TODO: we should find a way to order by segment! can be done in SQL but not prisma afaik. ordering can just be done in code.
];


////////////////////////////////////////////////////////////////
export const FileTagArgs = Prisma.validator<Prisma.FileTagArgs>()({
    include: {
        fileAssignments: true,
    }
});

export type FileTagPayload = Prisma.FileTagGetPayload<typeof FileTagArgs>;

export const FileTagNaturalOrderBy: Prisma.FileTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
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
    { fileTag: { sortOrder: 'desc' } },
    { fileTag: { text: 'asc' } },
    { fileTag: { id: 'asc' } },
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
    { sortOrder: 'desc' },
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

export type EventStatusPayloadBare = Prisma.EventStatusGetPayload<{}>;

export const EventStatusNaturalOrderBy: Prisma.EventStatusOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
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
    { sortOrder: 'desc' },
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
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];


export const EventSegmentUserResponseNaturalOrderBy: Prisma.EventSegmentUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];





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
            }
        },
    },
});
export type FrontpageGalleryItemPayload = Prisma.FrontpageGalleryItemGetPayload<typeof FrontpageGalleryItemArgs>;
export type FrontpageGalleryItemPayloadMinimum = Prisma.FrontpageGalleryItemGetPayload<{}>;
export type FrontpageGalleryItemPayloadForUpload = Prisma.FrontpageGalleryItemGetPayload<{
    include: { file: true }
}>;

export const FrontpageGalleryItemNaturalOrderBy: Prisma.FrontpageGalleryItemOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { id: 'asc' },
];

// always returns valid
export const getGalleryImageDisplayParams = (f: FrontpageGalleryItemPayload): ImageEditParams => {
    return parsePayloadJSON<ImageEditParams>(f.displayParams, MakeDefaultImageEditParams, (e) => {
        console.log(`failed to parse display param data for gallery item id ${f.id}`);
    });
};





////////////////////////////////////////////////////////////////

// TODO:

// generates 4 columns to link up this relationship:
// local tags field
// foreign tags field
export interface DefineManyToManyRelationshipArgs<TLocalPayload, TAssociationPayload, TForeignPayload> {
    // LOCAL
    localTableID: string; // "event"
    localColumnName: string; // "tags"

    local_getQuickFilterWhereClause?: (query: string) => TAnyModel; // basically this prevents the need to subclass and implement.
    local_getCustomFilterWhereClause?: (query: db3.CMDBTableFilterModel) => TAnyModel;
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
    foreign_getCustomFilterWhereClause?: (query: db3.CMDBTableFilterModel) => TAnyModel;
    foreign_doesItemExactlyMatchText?: (item: TAssociationPayload, filterText: string) => boolean;
};

export const DefineManyToManyRelationship = <TLocalPayload, TAssociationPayload, TForeignPayload>(args: DefineManyToManyRelationshipArgs<TLocalPayload, TAssociationPayload, TForeignPayload>) => {

};
