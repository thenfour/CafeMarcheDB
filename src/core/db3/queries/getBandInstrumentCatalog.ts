import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandInstrumentQuerySchema } from "../shared/entities/instrument/bandInstrumentContracts";
import { loadBandInstrumentOptInChoices } from "../server/bandInstrumentCatalog";

export default resolver.pipe(resolver.zod(BandInstrumentQuerySchema), async (input, ctx: Ctx) => {
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    return loadBandInstrumentOptInChoices(db, auth, input);
});
