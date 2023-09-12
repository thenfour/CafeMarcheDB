import { useQuery } from "@blitzjs/rpc"
import { Permission } from "shared/permissions"
import getCurrentUser from "src/auth/queries/getCurrentUser"

export const useCurrentUser = () => {
  return useQuery(getCurrentUser, null);
}
