// types used by mutations and other blitzy-things which can't export more than 1 thing.

export interface TupdateUserEventSegmentAttendanceMutationArgs {
    userId: number;
    eventSegmentId: number;
    attendanceId?: null | number;
    comment?: string | null;
    instrumentId?: number | null;
};

export interface TupdateEventBasicFieldsArgs {
    eventId: number;
    name?: string;
    slug?: string;
    description?: string;
    typeId?: number;
    locationDescription?: string;
    locationURL?: string;
    isDeleted?: boolean;
    statusId?: number;
    visiblePermissionId?: number | null;
    createdByUserId?: number;

    frontpageVisible?: boolean;
    frontpageDate?: string;  // e.g. "Zaterdag 11 november"
    frontpageTime?: string; // e.g. 14u
    frontpageTitle?: string | null; // null = use normal one
    frontpageDetails?: string;
    frontpageLocation?: string | null; // null = use normal
    frontpageLocationURI?: string | null; // null = use normal
    frontpageTags?: string | null; // null, use normal
}

export interface TupdateUserPrimaryInstrumentMutationArgs {
    userId: number;
    instrumentId: number;
};

export interface TinsertEventCommentArgs {
    eventId: number;
    text: string;
    visiblePermissionId: number | null;
    // created by user id = current user always
    // created at, updated at = automatic
};

export interface TinsertEventArgs {
    event: {
        name: string,
        description: string,
        slug: string,
        typeId: number | null,
        statusId: number | null,
        tags: number[],
        visiblePermissionId: number | null;
    },
    segment: {
        startsAt: Date | null,
        endsAt: Date | null,
        name: string,
        description: string,
    }
}

export interface TupdateEventCommentArgs {
    id: number;
    text?: string;
    visiblePermissionId?: number | null;
    // cannot change:
    // - event id
    // - user id
    // - created at
    // updated at = automatic
};

export type TGeneralDeleteArgs = {
    id: number;
};

export interface TdeleteEventCommentArgs {
    id: number;
};




/*
model EventSongList {
  id          Int    @id @default(autoincrement())
  sortOrder   Int    @default(0)
  name        String
  description String @default("")
  createdByUserId     Int? // required in order to know visibility when visiblePermissionId is NULL
  visiblePermissionId Int? // which permission determines visibility, when NULL, only visible by admins + creator
  eventId Int
}

model EventSongListSong {
  id        Int     @id @default(autoincrement())
  subtitle  String? // could be a small comment like "short version"
  sortOrder Int     @default(0)
  songId Int
  eventSongListId Int
}
*/

export interface TinsertOrUpdateEventSongListSong {
    id?: number;
    // don't rely on array ordering because it's shuffled etc during the change plan computation
    sortOrder: number;
    songId: number;
    subtitle: string;
};

export interface TinsertOrUpdateEventSongListArgs {
    id?: number; // for insertion, this is not used / specified.
    name: string;
    description: string;
    visiblePermissionId: number | null;
    eventId: number;
    sortOrder: number;
    songs: TinsertOrUpdateEventSongListSong[];
};

// interface from upload.ts to mutation. files themselves contain much of the data; this is only for associations.
export interface TClientUploadFileArgs {
    taggedUserId?: number;
    taggedSongId?: number;
    taggedEventId?: number;
    taggedInstrumentId?: number;
    visiblePermissionId?: number;
};

export interface TClientUpdateFile {
    id?: number;
    fileLeafName?: string;
    description?: string;
    isDeleted?: boolean; // allow soft delete via mutation
    visiblePermissionId?: number | null;

    tagsIds?: number[];
    taggedUserIds?: number[];
    taggedSongIds?: number[];
    taggedEventIds?: number[];
    taggedInstrumentIds?: number[];
};



// window.CMconfig.posts ....
export interface HomepageGalleryItemSpec {
    descriptionMarkdown: string;
    uri: string;
};
export interface HomepageAgendaItemSpec {
    date?: string | null;
    time?: string | null;
    title?: string | null;
    detailsMarkdown?: string | null;
    location?: string | null;
    locationURI?: string | null;
    tags?: string | null;
};
export interface HomepageContentSpec {
    agenda: HomepageAgendaItemSpec[];
    gallery: HomepageGalleryItemSpec[];
};

export interface FilePreviewData {
    // variations ?
};


