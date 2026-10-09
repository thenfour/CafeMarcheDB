import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xFrontpageGalleryItem } from "../db3";
import { MakeDefaultImageEditParams } from "../shared/fileTypes";
import { UpdateGalleryItemImageParamsSchema, UpdateGalleryItemImageResultSchema, type GalleryImageInput } from "../shared/galleryImage";
import { bindDB3ReadSnapshot, type DB3ReadContext, type DB3ReadRootDatabase } from "./db3ReadExecution";
import { resolvePublicId, resolvePublicForeignIds } from "./db3PublicIds";
import { requireAuthorizedMutationFields, updateImpl } from "./db3mutationCore";
import { withFileStorageRollback } from "./fileStorage";
import { createImageFork } from "./imageFork";

async function requireGalleryImageEdit(context: DB3ReadContext, args: GalleryImageInput) {
    const auth = context.authorization.requireUser();
    auth.requirePermission(Permission.edit_public_homepage);
    auth.requirePermission(Permission.upload_files);
    if (auth.requireBand().publicId !== args.bandPublicId) {
        throw new AuthorizationError("Gallery image editing requires the selected band.");
    }
    const identity = await resolvePublicId(xFrontpageGalleryItem, args.galleryItemId, auth, context.database);
    const gallery = await context.database.frontpageGalleryItem.findUniqueOrThrow({
        where: { id: identity },
        include: { file: true },
    });
    requireAuthorizedMutationFields(xFrontpageGalleryItem, xFrontpageGalleryItem.authorizeAndSanitize({
        contextDesc: "gallery image preflight", rowMode: "update", auth, existingModel: gallery,
        model: { displayParams: JSON.stringify(MakeDefaultImageEditParams()), fileId: gallery.fileId }, fallbackOwnerId: null,
    }));
    return gallery;
}

/** Gallery/File writes, audits and generated storage share one commit boundary. */
export async function updateGalleryItemImage(
    database: DB3ReadRootDatabase,
    authorization: CMServerAuthorization,
    input: GalleryImageInput,
    storageDirectory: string,
) {
    const args = UpdateGalleryItemImageParamsSchema.parse(input);
    return withFileStorageRollback(createdPaths => database.$transaction(async transaction => {
        const context = await bindDB3ReadSnapshot(transaction, authorization, { isolationLevel: "Serializable" });
        const gallery = await requireGalleryImageEdit(context, args);
        const newFile = await createImageFork(context,
            {
                ...args.imageParams,
                bandPublicId: args.bandPublicId
            }, storageDirectory, createdPaths);
        // Rotation, crop and resize are already in the new pixels; display them without a second edit.
        const newDisplayParams = MakeDefaultImageEditParams();
        const fields = await resolvePublicForeignIds(
            xFrontpageGalleryItem,
            {
                fileId: newFile.publicId,
                displayParams: JSON.stringify(newDisplayParams),
            },
            context.authorization,
            transaction
        );
        await updateImpl(xFrontpageGalleryItem, gallery.id, fields, context.authorization, transaction);
        return UpdateGalleryItemImageResultSchema.parse({ newFile, newDisplayParams });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }));
}
