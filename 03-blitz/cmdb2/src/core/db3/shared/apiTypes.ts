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

export interface TdeleteEventCommentArgs {
    id: number;
};


