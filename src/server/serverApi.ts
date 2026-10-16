import { serverGetAbsoluteUri } from "src/route/server/portalConfig";

// Server callers share the same configured public origin as page bootstrap.
export const ServerApi = { getAbsoluteUri: serverGetAbsoluteUri };
