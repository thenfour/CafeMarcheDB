import { useQuery } from "@blitzjs/rpc"
import { Permission } from "shared/permissions"
import getCurrentUser from "src/auth/queries/getCurrentUser"

export const useCurrentUser = () => {
  const [user] = useQuery(getCurrentUser, null)
  return user
}
