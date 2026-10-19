import type { Prisma } from "@prisma/client";
import db from "db";
import { parsePublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import type { BandPresentation, PresentationData } from "../shared/presentationContext";
import type { PresentationInput } from "../shared/presentationInput";
import { loadLocalizationCatalog, resolveAuthorizedDynamicStrings } from "./localization";

async function loadSelectedBandPresentation(database: Prisma.TransactionClient, auth: CMServerAuthorization,
    input: PresentationInput,
): Promise<BandPresentation | null> {
    if (!auth.band) {
        return null;
    }
    // Authorization has already resolved this active band in the same transaction.
    const band = await database.band.findUniqueOrThrow({
        where: { id: auth.band.id }, select: { publicId: true, nameId: true },
    });
    const names = await resolveAuthorizedDynamicStrings(database, auth, [band.nameId], input);
    return {
        publicId: parsePublicId<"Band">(band.publicId),
        name: names.get(band.nameId)?.value ?? null,
    };
}

// "Presentation" possibly a poorly-chosen word and honestly this should eventually
// have a powwow with dashboardContext such that one returns band-specific config (tag catalogs, settings, strings),
// the other does the same at a different context level. OR so.
// one can also argue that strings & settings should not be in the same payload, but
// for performance it's better.
// ... then you'd be right to wonder why we have both "presentation" and "dashboard context". Exactly.
// A single snapshot keeps locale availability, strings, settings, and grants consistent.
export async function loadPresentationData(auth: CMServerAuthorization, input: PresentationInput): Promise<PresentationData> {
    const start = Date.now();
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
        const freshAuth = await auth.refresh(tx);
        const [localization, settings, band] = await Promise.all([
            loadLocalizationCatalog(tx, freshAuth, input),
            loadSettingsSnapshot(tx, freshAuth),
            loadSelectedBandPresentation(tx, freshAuth, input),
        ]);
        return {
            input,
            authorization: freshAuth.toClientContext(),
            band,
            localization,
            settings,
            queryExecutionTimeMs: Date.now() - start,
        };
    }, { isolationLevel: "RepeatableRead" });
    return result;
}
