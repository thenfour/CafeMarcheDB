import type { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import type { DB3Authorization } from "../shared/db3Authorization";

/** Persisted-row authorization needs database permission IDs; UI checks do not. */
export type DB3ServerAuthorization = DB3Authorization<ServerPermissionSet>;
