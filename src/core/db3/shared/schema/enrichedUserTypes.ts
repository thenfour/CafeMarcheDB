// Replaced by band membership profiles/directory. Retain the full legacy behavior below until parity is verified.
export {};


// MIGRATION_RESTORE: directory-search
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/core/db3/shared/schema/enrichedUserTypes.ts:1-60
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore multi-value filter operators, presets, URL state, contact search policy, and CSV export for the selected band.
// Verification: Test filter combinations, permission restrictions, pagination, URL round trips, and exported rows; exercise the built directory.
// SHA256: 54d66c9de406c1e473089ce529a970f5ef1669567f5efa2817b71736b74c4072
// MIGRATION_REFERENCE_BEGIN
// import { TableAccessor } from "@/shared/rootroot";
// import * as db3 from "@db3/db3";
// import type { InstrumentPublicId, UserTagPublicId } from "shared/publicId";
//
// export type EnrichUserInput = Partial<db3.UserClientPayload>;
//
// type EnrichedUserInstrument = Omit<db3.UserInstrumentClientPayload, "instrument"> & {
//     instrument: db3.InstrumentDashboardClient;
// };
//
// export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
//     'tags'
//     | 'instruments'
// > & {
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
//     userTags: TableAccessor<db3.UserTagDashboardClient, UserTagPublicId>,
//     instruments: TableAccessor<db3.InstrumentDashboardClient, InstrumentPublicId>
// ): EnrichedUser<T> {
//     // original payload type,
//     // removing items we're replacing,
//     // + stuff we're adding/changing.
//     const ret = {
//         ...item,
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
