import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { requireFileStorageDirectory } from "../server/fileStorage";
import { updateGalleryItemImage } from "../server/galleryImage";
import { UpdateGalleryItemImageParamsSchema } from "../shared/galleryImage";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(UpdateGalleryItemImageParamsSchema),
    async (args, ctx: Ctx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        authorization.requireUser().requirePermission(Permission.edit_public_homepage);
        authorization.requirePermission(Permission.upload_files);
        return updateGalleryItemImage(db, authorization, args, requireFileStorageDirectory());
    },
);
