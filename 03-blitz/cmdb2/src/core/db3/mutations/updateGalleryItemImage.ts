// this should be done in a mutation because it's many db operations intertwined, and the return value is important.
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from 'blitz';
import { Permission } from "shared/permissions";
import { CoerceToNumberOr, CoerceToString, validateStringOption } from 'shared/utils';
import * as db3 from 'src/core/db3/db3';
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { ImageEditParams, UpdateGalleryItemImageParams } from 'src/core/db3/shared/apiTypes';
import db, { Prisma } from "db";


// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    //resolver.authorize(Permission.login),
    async (args: UpdateGalleryItemImageParams, ctx: AuthenticatedMiddlewareCtx) => {

        // // TODO
        // //CMDBAuthorizeOrThrow("UpdateGalleryItemImageParams", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser, };

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

        await mutationCore.updateImpl(db3.xFrontpageGalleryItem, args.galleryItemId, fields, ctx, clientIntention);

        return {
            newFile,
            newDisplayParams,
        };
    },
);


