import React from "react";
import type { BandHostingConfig } from "./portalRouting";

const PortalRoutingContext = React.createContext<BandHostingConfig | null>(null);

export function PortalRoutingProvider({ hosting, children }: React.PropsWithChildren<{ readonly hosting: BandHostingConfig }>) {
    return <PortalRoutingContext.Provider value={hosting}>{children}</PortalRoutingContext.Provider>;
}

export function usePortalHosting(): BandHostingConfig {
    const hosting = React.useContext(PortalRoutingContext);
    if (!hosting) {
        throw new Error("Portal routing requires the application's hosting context.");
    }
    return hosting;
}
