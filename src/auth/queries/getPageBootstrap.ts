import type { Ctx } from "blitz";
import type { NextPageContext } from "next";
import { z } from "zod";
import { getSessionForRequest } from "src/blitz-server";
import { loadPresentationData } from "src/locale/server/presentation";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { publicHomepageSelection } from "src/server/publicHomepage";
import { loadDbBrandConfig } from "src/server/brand";
import { loadPageAuthorization } from "../server/pageRequestAuthorization";

const PageBootstrapInputSchema = PresentationInputSchema.extend({ pathname: z.string().max(512) });
type PageBootstrapInput = z.infer<typeof PageBootstrapInputSchema>;
type PageBootstrapContext = Ctx | Pick<NextPageContext, "req" | "res">;

async function pageSession(context: PageBootstrapContext) {
    if ("session" in context) {
        return context.session;
    }
    if (!context.req || !context.res) {
        throw new Error("Server page request is missing its request or response.");
    }
    return getSessionForRequest(context.req, context.res);
}

// The query boundary keeps server imports out of _app's browser bundle. SSR passes
// its request context directly; client navigations use Blitz's authenticated RPC context.
export default async function getPageBootstrap(input: PageBootstrapInput, context: PageBootstrapContext) {
    const { pathname, ...requestedPresentation } = PageBootstrapInputSchema.parse(input);
    const presentationInput = pathname === "/" ? publicHomepageSelection(requestedPresentation) : requestedPresentation;
    const session = await pageSession(context);
    const auth = await loadPageAuthorization(pathname, session, presentationInput.bandPublicId ?? undefined);
    const presentation = await loadPresentationData(auth, presentationInput);
    const host = "req" in context ? context.req?.headers.host : undefined;
    const brand = await loadDbBrandConfig(host, auth.band?.id ?? null);
    return { presentation, brand };
}
