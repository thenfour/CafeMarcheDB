export const PUBLIC_ID_LENGTH = 16;
export const PUBLIC_ID_PLACEHOLDER_PREFIX = "~";

const PublicIdPattern = /^[A-Za-z0-9_-]{16}$/;

declare const publicIdBrand: unique symbol;

export type PublicId<TTable extends string = string> = string & {
    readonly [publicIdBrand]: TTable;
};

export type InstrumentFunctionalGroupPublicId = PublicId<"InstrumentFunctionalGroup">;
export type InstrumentPublicId = PublicId<"Instrument">;
export type InstrumentTagPublicId = PublicId<"InstrumentTag">;
export type InstrumentTagAssociationPublicId = PublicId<"InstrumentTagAssociation">;
export type SongTagPublicId = PublicId<"SongTag">;
export type SongTagAssociationPublicId = PublicId<"SongTagAssociation">;
export type SongCreditTypePublicId = PublicId<"SongCreditType">;
export type SongCreditPublicId = PublicId<"SongCredit">;
export type FileTagPublicId = PublicId<"FileTag">;
export type FileTagAssignmentPublicId = PublicId<"FileTagAssignment">;
export type FileUserTagPublicId = PublicId<"FileUserTag">;
export type FileSongTagPublicId = PublicId<"FileSongTag">;
export type FileEventTagPublicId = PublicId<"FileEventTag">;
export type FileInstrumentTagPublicId = PublicId<"FileInstrumentTag">;
export type FileWikiPageTagPublicId = PublicId<"FileWikiPageTag">;
export type WikiPageTagPublicId = PublicId<"WikiPageTag">;
export type WikiPageTagAssignmentPublicId = PublicId<"WikiPageTagAssignment">;
export type EventSegmentPublicId = PublicId<"EventSegment">;
export type EventUserResponsePublicId = PublicId<"EventUserResponse">;
export type EventSegmentUserResponsePublicId = PublicId<"EventSegmentUserResponse">;
export type EventAttendancePublicId = PublicId<"EventAttendance">;
export type EventTypePublicId = PublicId<"EventType">;
export type EventStatusPublicId = PublicId<"EventStatus">;
export type EventTagPublicId = PublicId<"EventTag">;
export type EventTagAssignmentPublicId = PublicId<"EventTagAssignment">;
export type UserTagPublicId = PublicId<"UserTag">;
export type UserTagAssignmentPublicId = PublicId<"UserTagAssignment">;
export type UserInstrumentPublicId = PublicId<"UserInstrument">;
export type PermissionPublicId = PublicId<"Permission">;
export type RolePublicId = PublicId<"Role">;
export type RolePermissionPublicId = PublicId<"RolePermission">;
export type UserSignInMethodPublicId = PublicId<"UserSignInMethod">;
export type EventSongListPublicId = PublicId<"EventSongList">;
export type EventSongListSongPublicId = PublicId<"EventSongListSong">;
export type EventSongListDividerPublicId = PublicId<"EventSongListDivider">;
// todo: define other table-specific public ID types as needed here.

export function isPublicId(value: unknown): value is PublicId {
    return typeof value === "string" && PublicIdPattern.test(value);
}

export function parsePublicId<TTable extends string = string>(value: unknown): PublicId<TTable> {
    if (!isPublicId(value)) {
        throw new Error(`Expected a ${PUBLIC_ID_LENGTH}-character public ID.`);
    }
    return value as PublicId<TTable>;
}

// function isNumber(value: unknown): value is number {
//     return typeof value === "number";
// }
// function isString(value: unknown): value is string {
//     return typeof value === "string";
// }

export function isPublicIdIsh(value: unknown): value is number | string {
    return typeof value === "number" || typeof value === "string";
}
