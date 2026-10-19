import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { forkImage } from "../server/imageFork";
import { requireFileStorageDirectory } from "../server/fileStorage";
import { ForkImageParamsSchema } from "../shared/imageFork";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ForkImageParamsSchema),
    async (args, ctx: Ctx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        authorization.requireUser().requirePermission(BandPermission.upload_files);
        return forkImage(db, authorization, args, requireFileStorageDirectory());
    },
);
