import { Permission } from "shared/permissions"
import getAuthorization from "../queries/getAuthorized"
import { useQuery } from "@blitzjs/rpc"
import { gQueryOptions } from "shared/utils";

export const useAuthorization = (reason: string, permission: Permission) => {
    const [isAuthorized] = useQuery(getAuthorization, { reason, permission, cmdbQueryContext: "useAuthorization" }, gQueryOptions.default);
    return isAuthorized;
}
