import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readSongPinnedRecordings, SongPinnedRecordingsSchema } from "../server/songPinnedRecordings";

export default resolver.pipe(
    resolver.zod(SongPinnedRecordingsSchema),
    async (args, ctx: Ctx) => readSongPinnedRecordings(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
