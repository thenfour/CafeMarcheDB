import React from "react";
import { useRouter } from "next/router";
import { CmdbClientRouter } from "./clientRouter";
import type { CmdbRouterRequestArgs } from "./portalRouting";

const PortalRoutingContext = React.createContext<CmdbClientRouter | null>(null);

export function PortalRoutingProvider({ config, children }: React.PropsWithChildren<{ readonly config: CmdbRouterRequestArgs }>) {
    const nextRouter = useRouter();
    const value = React.useMemo(() => new CmdbClientRouter({ ...config, nextRouter }), [config, nextRouter]);
    return <PortalRoutingContext.Provider value={value}>{children}</PortalRoutingContext.Provider>;
}

export function useCmdbRouter(): CmdbClientRouter {
    const value = React.useContext(PortalRoutingContext);
    if (!value) {
        throw new Error("useCmdbRouter requires PortalRoutingProvider.");
    }
    return value;
}
