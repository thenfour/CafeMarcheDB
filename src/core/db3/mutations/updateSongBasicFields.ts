import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { UpdateSongBasicFieldsSchema, updateSongBasicFields } from "../server/songEditing";

export default resolver.pipe(resolver.zod(UpdateSongBasicFieldsSchema),
    async (args, ctx: Ctx) => updateSongBasicFields(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
