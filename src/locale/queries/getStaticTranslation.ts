// // TODO: explain what this is? it's not currently used, and has odd 

// import { resolver } from "@blitzjs/rpc";
// import type { Ctx } from "blitz";
// import { z } from "zod";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { kStaticLocalizedStringRegistry, type StaticLocalizedStringKey } from "../shared/staticLocalizedStringRegistry";
// import { PresentationSelectionSchema, selectionFromPresentationInput } from "../shared/presentationInput";
// import { localizationDatabase, lookupStaticTranslation } from "../server/localization";

// export default resolver.pipe(
//     resolver.zod(z.object({
//         key: z.string().refine(key => Object.prototype.hasOwnProperty.call(kStaticLocalizedStringRegistry, key)),
//         localeTag: z.string(),
//         scope: z.enum(["global", "band"]),
//         selection: PresentationSelectionSchema.optional()
//     }).strict()),
//     async (input, ctx: Ctx) => {
//         const auth = await loadAuthorization(ctx.session, selectionFromPresentationInput(input.selection));
//         // The schema above restricts the runtime key to the registered union.
//         return lookupStaticTranslation(localizationDatabase, await auth.refresh(), input.key as StaticLocalizedStringKey, input.localeTag, input.scope);
//     },
// );
