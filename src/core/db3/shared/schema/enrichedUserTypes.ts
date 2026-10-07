import { TableAccessor } from "@/shared/rootroot";
import * as db3 from "@db3/db3";
import type { InstrumentPublicId, UserTagPublicId } from "shared/publicId";

export type EnrichUserInput = Partial<db3.UserClientPayload>;

type EnrichedUserInstrument = Omit<db3.UserInstrumentClientPayload, "instrument"> & {
    instrument: db3.InstrumentDashboardClient;
};

export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
    'tags'
    | 'instruments'
> & {
    tags: (Omit<db3.UserTagAssignmentClientPayload, "userTag"> & {
        userTag: db3.UserTagDashboardClient;
    })[];
    instruments: EnrichedUserInstrument[];
};


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichUser<T extends EnrichUserInput>(
    item: T,
    userTags: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>,
    instruments: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>
): EnrichedUser<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    const ret = {
        ...item,

        tags: (item.tags || []).map((assoc) => {
            const ret: Omit<db3.UserTagAssignmentClientPayload, "userTag"> & {
                userTag: db3.UserTagDashboardClient;
            } = {
                ...assoc,
                userTag: userTags.getById(assoc.userTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.userTag.sortOrder - b.userTag.sortOrder), // respect ordering

        instruments: (item.instruments || []).map((assoc) => {
            const ret: EnrichedUserInstrument = {
                ...assoc,
                instrument: instruments.find(
                    instrument => db3.getInstrumentIdentity(instrument) === assoc.instrumentId,
                )! // enrich!
            };
            return ret;
        }).sort((a, b) => a.instrument.sortOrder - b.instrument.sortOrder), // respect ordering
    };

    // TypeScript cannot reduce this generic Omit/intersection after object spread,
    // but each replaced property is constructed with the exact EnrichedUser type above.
    return ret as EnrichedUser<T>;
}

export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/schema/enrichedUserTypes.ts:1-64
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 79a08cee8c2a04bb707c642a639dcb5fa53d36489fd703b9d0eb9450b8ea4434
// MIGRATION_REFERENCE_BEGIN
// import { TableAccessor } from "@/shared/rootroot";
// import * as db3 from "@db3/db3";
// import type { InstrumentPublicId, RolePublicId, UserTagPublicId } from "shared/publicId";
//
// export type EnrichUserInput = Partial<db3.UserClientPayload>;
//
// type EnrichedUserInstrument = Omit<db3.UserInstrumentClientPayload, "instrument"> & {
//     instrument: db3.InstrumentDashboardClient;
// };
//
// export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
//     'role'
//     | 'tags'
//     | 'instruments'
// > & {
//     role: db3.CompleteRoleDashboardClient | null | undefined;
//     tags: (Omit<db3.UserTagAssignmentClientPayload, "userTag"> & {
//         userTag: db3.UserTagDashboardClient;
//     })[];
//     instruments: EnrichedUserInstrument[];
// };
//
//
// // takes a bare event and applies eventstatus, type, visiblePermission, et al
// export function enrichUser<T extends EnrichUserInput>(
//     item: T,
//     roles: TableAccessor<db3.CompleteRoleDashboardClient, RolePublicId>,
//     userTags: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>,
//     instruments: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>
// ): EnrichedUser<T> {
//     // original payload type,
//     // removing items we're replacing,
//     // + stuff we're adding/changing.
//     const ret = {
//         ...item,
//         role: item.roleId == null ? null : roles.getById(item.roleId),
//
//         tags: (item.tags || []).map((assoc) => {
//             const ret: Omit<db3.UserTagAssignmentClientPayload, "userTag"> & {
//                 userTag: db3.UserTagDashboardClient;
//             } = {
//                 ...assoc,
//                 userTag: userTags.getById(assoc.userTagId)! // enrich!
//             };
//             return ret;
//         }).sort((a, b) => a.userTag.sortOrder - b.userTag.sortOrder), // respect ordering
//
//         instruments: (item.instruments || []).map((assoc) => {
//             const ret: EnrichedUserInstrument = {
//                 ...assoc,
//                 instrument: instruments.find(
//                     instrument => db3.getInstrumentIdentity(instrument) === assoc.instrumentId,
//                 )! // enrich!
//             };
//             return ret;
//         }).sort((a, b) => a.instrument.sortOrder - b.instrument.sortOrder), // respect ordering
//     };
//
//     // TypeScript cannot reduce this generic Omit/intersection after object spread,
//     // but each replaced property is constructed with the exact EnrichedUser type above.
//     return ret as EnrichedUser<T>;
// }
//
// export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;
// MIGRATION_REFERENCE_END
