import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { PresentationInputSchema } from "../shared/presentationInput";
import { loadPresentationData } from "../server/presentation";

export default resolver.pipe(
    resolver.zod(PresentationInputSchema),
    async (input, ctx: Ctx) => loadPresentationData(
        await loadAuthorization(ctx.session, input.bandPublicId), input,
    ),
);
