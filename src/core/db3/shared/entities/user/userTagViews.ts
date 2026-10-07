import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xBandUserTag } from "./bandUserTagViews";
import "./bandUserTags"; // Register the child descriptor before compiling its invitation view.

export const userTagEventSearchSelection = Prisma.validator<Prisma.BandUserTagDefaultArgs>()({
    select: {
        publicId: true,
        bandUserTagAssignments: { select: { bandUserId: true } },
    },
});
const contract = deriveViewContract(xBandUserTag, userTagEventSearchSelection);
export const userTagEventSearchView = defineView({
    viewID: "BandUserTag_EventInvitation", entity: xBandUserTag,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});

// MIGRATION_RESTORE: dashboard-content
// Source: 0daa91f9a97659ea53be501712e659ed776e8e38:src/core/db3/shared/entities/user/userTagViews.ts:1-58
// Reason: Event response and invitation readers now use selected-band membership contracts.
// Restore: Verify full event search and invitation editor behavior on the target schema.
// Verification: Adapt the preserved event views and exercise complete event workflows in the built application.
// SHA256: 1d58fa1ef329715ad3aaeabae6763103b15cd60e3d12779a4d1a2c8a3b5c62ea
// MIGRATION_REFERENCE_BEGIN
// import { Prisma } from "db";
// import { defineCrudView } from "../../core/db3CrudView";
// import { defineView } from "../../core/db3View";
// import { deriveViewContract } from "../../core/db3ViewContract";
// import { xUserTag } from "../../schema/user";
//
// const UserTagArgs = Prisma.validator<Prisma.UserTagDefaultArgs>()({
//     select: {
//         publicId: true,
//         text: true,
//         description: true,
//         color: true,
//         sortOrder: true,
//         cssClass: true,
//     },
// });
//
// const userTagViewContract = deriveViewContract(
//     xUserTag,
//     UserTagArgs,
// );
//
// export const userTagEditorView = defineCrudView({
//     viewID: "UserTag_Editor",
//     entity: xUserTag,
//     operations: { create: true, update: true, delete: true },
//     hydrate: userTagViewContract.hydrate,
//     selection: userTagViewContract.prismaSelection,
//     dtoSchema: userTagViewContract.dtoSchema,
// });
//
// export const userTagEventSearchSelection = Prisma.validator<Prisma.UserTagDefaultArgs>()({
//     select: {
//         publicId: true,
//         text: true,
//         userAssignments: {
//             where: {
//                 user: { isDeleted: false },
//             },
//             select: {
//                 userId: true,
//             },
//         },
//     },
// });
//
// const userTagEventSearchContract = deriveViewContract(
//     xUserTag,
//     userTagEventSearchSelection,
// );
//
// export const userTagEventSearchView = defineView({
//     viewID: "UserTag_EventSearch",
//     entity: xUserTag,
//     selection: userTagEventSearchContract.prismaSelection,
//     dtoSchema: userTagEventSearchContract.dtoSchema,
//     hydrate: userTagEventSearchContract.hydrate,
// });
// MIGRATION_REFERENCE_END
