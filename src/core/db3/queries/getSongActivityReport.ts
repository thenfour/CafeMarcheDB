import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { SongHistoryInputSchema } from "../shared/entities/song/songHistory";
import { readSongHistory } from "../server/songHistory";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = SongHistoryInputSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readSongHistory(db, auth, args);
});
