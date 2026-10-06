import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandInstrumentQuerySchema } from "../shared/entities/instrument/bandInstrumentContracts";
import { loadBandInstrumentCatalog } from "../server/bandInstrumentCatalog";

export default resolver.pipe(resolver.zod(BandInstrumentQuerySchema), async (input, ctx: Ctx) => {
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    return db.$transaction(async tx => loadBandInstrumentCatalog(tx, await auth.refresh(tx), input, input.includeHidden),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
});
