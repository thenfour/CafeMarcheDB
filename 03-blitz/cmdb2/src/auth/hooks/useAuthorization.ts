import { Permission } from "shared/permissions"
import getAuthorization from "../queries/getAuthorized"
import { useQuery } from "@blitzjs/rpc"

export const useAuthorization = (reason: string, permission: Permission) => {
    const [isAuthorized] = useQuery(getAuthorization, { reason, permission });
    return isAuthorized;
}
