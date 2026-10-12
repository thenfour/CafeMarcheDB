import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { MemberSongCreditsInputSchema } from "../shared/entities/user/memberSongCredits";
import { readMemberSongCredits } from "../server/memberSongCredits";

export default resolver.pipe(
    resolver.zod(MemberSongCreditsInputSchema),
    async (args, ctx: Ctx) => readMemberSongCredits(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
