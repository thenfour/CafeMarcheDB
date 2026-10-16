import type { NextRouter } from "next/router";
import { applicationQuery, CmdbRouter, replacePortalPathname, retainPortalPageState, type CmdbRouterRequestArgs } from "./portalRouting";

type NavigationOptions = Parameters<NextRouter["push"]>[2];

/** URL construction is shared; navigation receives an already constructed href. */
export class CmdbClientRouter extends CmdbRouter {
    private readonly nextRouter: NextRouter;

    constructor(config: CmdbRouterRequestArgs & { readonly nextRouter: NextRouter }) {
        super(config);
        this.nextRouter = config.nextRouter;
    }

    push(href: string, options?: NavigationOptions) {
        return this.nextRouter.push(href, undefined, options);
    }

    replace(href: string, options?: NavigationOptions) {
        return this.nextRouter.replace(href, undefined, options);
    }

    replaceCurrentPage(href: string) {
        return this.replace(retainPortalPageState(href, this.asPath), { shallow: true });
    }

    pushCurrentPage(href: string) {
        return this.push(retainPortalPageState(href, this.asPath), { shallow: true });
    }

    get asPath() {
        return this.nextRouter.asPath;
    }

    get pathname() {
        return this.nextRouter.pathname;
    }

    get query() {
        return applicationQuery(this.nextRouter.query);
    }

    switchLanguage(routeLocale: string | null) {
        const current = new URL(this.asPath, "https://cmdb.invalid");
        // Shallow tab/slug updates change asPath without running bootstrap again.
        const prefix = replacePortalPathname(this.requestPath, "");
        const remainder = current.pathname.slice(prefix.length);
        const internalPathname = this.requestPath.hasBandPrefix ? `/backstage${remainder}` : remainder || "/";
        const href = this.href(`${internalPathname}${current.search}${current.hash}`, { routeLocale });
        return this.push(href);
    }
}
