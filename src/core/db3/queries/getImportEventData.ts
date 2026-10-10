import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readEventImportPreview } from "../server/eventImport";
import { ZGetImportEventDataArgs } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.zod(ZGetImportEventDataArgs),
    async (args, ctx: Ctx) => readEventImportPreview(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
