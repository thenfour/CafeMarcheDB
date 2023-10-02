// types used by mutations and other blitzy-things which can't export more than 1 thing.

export interface TupdateUserEventSegmentAttendanceMutationArgs {
    userId: number;
    eventSegmentId: number;
    attendanceId?: null | number;
    comment?: string | null;
    instrumentId?: number | null;
};

// export interface TupdateUserEventSegmentAttendanceCommentMutationArgs {
//     userId: number;
//     eventSegmentId: number;
//     comment: string | null;
// };

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

