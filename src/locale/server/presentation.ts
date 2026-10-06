import type { Prisma } from "@prisma/client";
import db from "db";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { loadLocalizationCatalog } from "./localization";
import type { PresentationData } from "../shared/presentationContext";
import type { PresentationInput } from "../shared/presentationInput";

// "Presentation" possibly a poorly-chosen word and honestly this should eventually
// have a powwow with dashboardContext such that one returns band-specific config (tag catalogs, settings, strings),
// the other does the same at a different context level. OR so.
// one can also argue that strings & settings should not be in the same payload, but
// for performance it's better.
// ... then you'd be right to wonder why we have both "presentation" and "dashboard context". Exactly.
// A single snapshot keeps locale availability, strings, settings, and grants consistent.
export async function loadPresentationData(auth: CMServerAuthorization, input: PresentationInput): Promise<PresentationData> {
    return db.$transaction(async (tx: Prisma.TransactionClient) => {
        const freshAuth = await auth.refresh(tx);
        const [localization, settings] = await Promise.all([
            loadLocalizationCatalog(tx, freshAuth, input),
            loadSettingsSnapshot(tx, freshAuth),
        ]);
        return {
            input,
            authorization: freshAuth.toClientContext(),
            localization,
            settings,
        };
    }, { isolationLevel: "RepeatableRead" });
}
