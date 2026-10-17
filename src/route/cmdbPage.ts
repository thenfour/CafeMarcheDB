import type { JSXElementConstructor } from "react";
import { CmdbRouteRegistry, type CmdbRouteKey } from "./cmdbRoutes";

/** Attach identity to the component Next selects, preserving its props and static hooks. */
// Call before a named default export; Blitz derives route factory names from that export.
// never permits each page's required props; TPage retains the concrete component type.
export function defineCmdbPage<const TKey extends CmdbRouteKey, TPage extends JSXElementConstructor<never>>(
    routeKey: TKey,
    page: TPage,
) {
    return Object.assign(page, { routeKey });
}

/** Framework components may lack application metadata; fail before loading page data. */
export function requirePageRouteKey(component: unknown): CmdbRouteKey {
    if ((typeof component !== "function" && (typeof component !== "object" || component === null))
        || !("routeKey" in component)) {
        throw new Error("Page is missing CMDB route metadata.");
    }
    if (!CmdbRouteRegistry.isRouteKey(component.routeKey)) {
        throw new Error(`Invalid page route key: ${String(component.routeKey)}`);
    }
    return component.routeKey;
}
