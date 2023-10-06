import { useQuery } from "@blitzjs/rpc"
import { Permission } from "shared/permissions"
import { gQueryOptions } from "shared/utils";
import getCurrentUser from "src/auth/queries/getCurrentUser"

export const useCurrentUser = () => {
  return useQuery(getCurrentUser, { cmdbQueryContext: "useCurrentUser" }, gQueryOptions.default);
}
