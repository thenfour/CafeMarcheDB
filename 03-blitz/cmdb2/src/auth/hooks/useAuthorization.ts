import { Permission } from "shared/permissions"
import getAuthorization from "../queries/getAuthorized"
import { useQuery } from "@blitzjs/rpc"

export const useAuthorization = (reason: string, permission: Permission) => {
    const [isAuthorized] = useQuery(getAuthorization, { reason, permission, cmdbQueryContext: "useAuthorization" }, {
        staleTime: Infinity,
        cacheTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: true,
    }
    );
    return isAuthorized;
}
