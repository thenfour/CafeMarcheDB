import React from "react";
import type { ServerStartInfo } from "shared/serverStateBase";

export const ServerStartupStateContext = React.createContext<ServerStartInfo | null>(null);
export const useServerStartupState = () => React.useContext(ServerStartupStateContext);
