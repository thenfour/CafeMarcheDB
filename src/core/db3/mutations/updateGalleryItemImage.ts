import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("fileCreation"),
);

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/db3/mutations/updateGalleryItemImage.ts:1-75
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: faecb953a862d04f0447f421b0910d6c307843a2c068b9e03761d1909d02cf1a
// MIGRATION_REFERENCE_BEGIN
// // this should be done in a mutation because it's many db operations intertwined, and the return value is important.
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from 'blitz';
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
// import * as db3 from 'src/core/db3/db3';
// import * as mutationCore from 'src/core/db3/server/db3mutationCore';
// import { ImageEditParams, UpdateGalleryItemImageParams } from "../shared/fileTypes";
//
//
// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     resolver.authorize(Permission.edit_public_homepage),
//     async (args: UpdateGalleryItemImageParams, ctx: AuthenticatedCtx) => {
//         const auth = await loadAuthorization(ctx.session);
//         const authWithUser = auth.requireUser();
//
//
//         // Verify the target before ForkImageImpl performs any filesystem work.
//         // The resolver permission matches the gallery table's mutation policy;
//         // gallery rows have no owner-specific mutation rules.
//         const galleryItem = await db.frontpageGalleryItem.findFirst({
//             where: {
//                 publicId: args.galleryItemId,
//                 isDeleted: false,
//             },
//         });
//         if (!galleryItem) {
//             throw new Error("Gallery item was not found.");
//         }
//
//         const galleryMutationFields = {
//             fileId: galleryItem.fileId,
//             displayParams: galleryItem.displayParams,
//         };
//         const authorization = db3.xFrontpageGalleryItem.authorizeAndSanitize({
//             contextDesc: "updateGalleryItemImage:preflight",
//             model: galleryMutationFields,
//             existingModel: galleryItem,
//             auth: auth,
//             rowMode: "update",
//             fallbackOwnerId: null,
//         });
//         if (!authorization.rowIsAuthorized
//             || authorization.unauthorizedColumnCount > 0
//             || authorization.unknownColumnCount > 0) {
//             throw new mutationCore.DB3MutationAuthorizationError(
//                 db3.xFrontpageGalleryItem.tableName,
//                 Object.keys(galleryMutationFields),
//             );
//         }
//
//         // create the new file
//         const newFile = await mutationCore.ForkImageImpl(args.imageParams, authWithUser);
//
//         const newDisplayParams: ImageEditParams = {
//             ...args.imageParams.editParams,
//             cropBegin: { x: 0, y: 0 },
//             cropSize: null,
//         };
//
//         const fields: Prisma.FrontpageGalleryItemUncheckedUpdateInput = {
//             fileId: newFile.id,
//             displayParams: JSON.stringify(newDisplayParams),
//         }
//
//         await mutationCore.updateImpl(db3.xFrontpageGalleryItem, galleryItem.id, fields, auth);
//
//         return {
//             newFile: { publicId: db3.xFile.parseIdentity(newFile.publicId) },
//             newDisplayParams,
//         };
//     },
// );
// MIGRATION_REFERENCE_END
