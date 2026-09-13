// this should be done in a mutation because it's many db operations intertwined, and the return value is important.
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from 'blitz';
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from 'src/core/db3/db3';
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { ImageEditParams, UpdateGalleryItemImageParams } from "../shared/fileTypes";


// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_public_homepage),
    async (args: UpdateGalleryItemImageParams, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new Error("Current user was not found.");
        }


        // Verify the target before ForkImageImpl performs any filesystem work.
        // The resolver permission matches the gallery table's mutation policy;
        // gallery rows have no owner-specific mutation rules.
        const galleryItem = await db.frontpageGalleryItem.findFirst({
            where: {
                id: args.galleryItemId,
                isDeleted: false,
            },
        });
        if (!galleryItem) {
            throw new Error("Gallery item was not found.");
        }

        const galleryMutationFields = {
            fileId: galleryItem.fileId,
            displayParams: galleryItem.displayParams,
        };
        const authorization = db3.xFrontpageGalleryItem.authorizeAndSanitize({
            contextDesc: "updateGalleryItemImage:preflight",
            model: galleryMutationFields,
            existingModel: galleryItem,
            publicData: db3.createDB3Authorization(currentUser, (await getRequestAuthorization(ctx.session)).effectivePermissions),
            rowMode: "update",
            fallbackOwnerId: null,
        });
        if (!authorization.rowIsAuthorized
            || authorization.unauthorizedColumnCount > 0
            || authorization.unknownColumnCount > 0) {
            throw new mutationCore.DB3MutationAuthorizationError(
                db3.xFrontpageGalleryItem.tableName,
                Object.keys(galleryMutationFields),
            );
        }

        // create the new file
        const newFile = await mutationCore.ForkImageImpl(args.imageParams, ctx);

        const newDisplayParams: ImageEditParams = {
            ...args.imageParams.editParams,
            cropBegin: { x: 0, y: 0 },
            cropSize: null,
        };

        const fields: Prisma.FrontpageGalleryItemUncheckedUpdateInput = {
            fileId: newFile.id,
            displayParams: JSON.stringify(newDisplayParams),
        }

        await mutationCore.updateImpl(db3.xFrontpageGalleryItem, args.galleryItemId, fields, ctx);

        return {
            newFile,
            newDisplayParams,
        };
    },
);


