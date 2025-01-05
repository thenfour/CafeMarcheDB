import { useQuery } from "@blitzjs/rpc";
import { gQueryOptions } from "shared/utils";
import getCurrentUser from "src/auth/queries/getCurrentUser";

export const useCurrentUser = () => {
  return useQuery(getCurrentUser, null, gQueryOptions.default);
}
