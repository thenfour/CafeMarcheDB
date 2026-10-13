import { useRouter } from "next/router";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { usePortalHosting } from "./PortalRoutingProvider";
import { portalHref, type RouteBandAndLocale } from "./portalRouting";

// lsmb TODO: this should directly understand
// our backstage routes registry, and be the coordinator for all platform-wide route
// services 
// - parsing, manips, conversions. ...
// - breadcrumbs
// - generating custom links

/** Pages choose their destination; this owner retains the current portal and language. */
export function useCmdbRouter() {
    const router = useRouter();
    const presentation = usePresentation();
    const hosting = usePortalHosting();
    const selection: RouteBandAndLocale = { bandPublicId: presentation.bandPublicId, routeLocale: presentation.data?.input.routeLocale };
    const href = (path: string, destination: RouteBandAndLocale = selection) => portalHref(path, destination, hosting);
    return {
        ...router,
        href,
        push: (path: string, options?: Parameters<typeof router.push>[2]) => router.push(href(path), undefined, options),
        replace: (path: string, options?: Parameters<typeof router.replace>[2]) => router.replace(href(path), undefined, options),
        switchLanguage: (routeLocale: string | null) => router.push(href(router.asPath, { ...selection, routeLocale })),
    };
}
