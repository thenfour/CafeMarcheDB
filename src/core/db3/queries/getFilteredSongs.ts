import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readSetlistSong } from "../server/setlistSongRead";
import { GetFilteredSongsArgsSchema } from "../shared/apiTypes";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = GetFilteredSongsArgsSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readSetlistSong(db, auth, args);
});
