import React from "react";
import { CmdbRouteRegistry, type CmdbRouteKey } from "./cmdbRoutes";

const PageRouteContext = React.createContext<CmdbRouteKey | null>(null);

export function PageRouteProvider({ routeKey, children }: React.PropsWithChildren<{ readonly routeKey: CmdbRouteKey }>) {
    return <PageRouteContext.Provider value={routeKey}>{children}</PageRouteContext.Provider>;
}

export function usePageRoute() {
    const routeKey = React.useContext(PageRouteContext);
    if (routeKey === null) {
        throw new Error("PageRouteProvider is required to read the current page route.");
    }
    return CmdbRouteRegistry.routeByKey(routeKey);
}
