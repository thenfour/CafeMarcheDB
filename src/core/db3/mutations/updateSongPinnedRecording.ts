import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { UpdateSongPinnedRecordingSchema, updateSongPinnedRecording } from "../server/songEditing";

export default resolver.pipe(resolver.zod(UpdateSongPinnedRecordingSchema),
    async (args, ctx: Ctx) => updateSongPinnedRecording(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
