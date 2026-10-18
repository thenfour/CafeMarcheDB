import React from "react";
import { hydrateServerStartInfo, type ServerStartInfo, type ServerStartInfoDto } from "shared/serverStateBase";

export const ServerStartupStateContext = React.createContext<ServerStartInfo | null>(null);

export function ServerStartupStateProvider({ value, children }: React.PropsWithChildren<{ value: ServerStartInfoDto | null }>) {
    // Restore dates before consumers render, on both the server and the browser.
    const info = React.useMemo(() => hydrateServerStartInfo(value), [value]);
    return <ServerStartupStateContext.Provider value={info}>{children}</ServerStartupStateContext.Provider>;
}

export const useServerStartupState = () => React.useContext(ServerStartupStateContext);
