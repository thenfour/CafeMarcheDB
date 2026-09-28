import type { Ctx } from "blitz";
import db from "db";
import * as db3 from "src/core/db3/db3";
import { projectDB3ModelPublicIds } from "src/core/db3/server/db3PublicIds";
import { loadAuthorization } from "src/auth/server/serverAuthorization";

export default async function getCurrentUser(_ = null, { session }: Ctx) {

  const auth = await loadAuthorization(session);

  if (!auth.userId) {
    return null;
  }
  const authWithUser = auth.requireUser();

  // TODO: I don't think this query even needs to exist. useDashboardData provides this.
  // it has other problems too:
  // 1. it queries the database directly instead of using db3 views
  // 2. it returns a very large payload with unnecessary data because it's just using
  //    the full db3.UserArgs.

  const user = await db.user.findFirst({
    where: { id: authWithUser.userId, isDeleted: false },
    ...db3.UserArgs
  });

  // should never happen but this is not in a transaction so...
  if (!user) return null;

  // xUser's relation metadata defines the runtime projection; this annotation
  // records the corresponding client shape for Blitz's inferred query result.
  const projected = projectDB3ModelPublicIds(
    db3.xUser,
    user,
    authWithUser) as db3.UserClientPayload;

  // blitz auth requires the numeric id; this is one exception to the "public id"
  // policy.
  return { ...projected, id: auth.userId } satisfies db3.SelfUserClientPayload;
}
