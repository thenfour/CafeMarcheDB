import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { UpdateEventBasicFieldsSchema, updateEventBasicFields } from "../server/eventEditing";

export default resolver.pipe(
    resolver.zod(UpdateEventBasicFieldsSchema),
    async (args, ctx: Ctx) => updateEventBasicFields(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
