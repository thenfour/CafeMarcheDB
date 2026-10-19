import type { Ctx } from "blitz";
import { parsePublicId } from "shared/publicId";
import type { CurrentAccount } from "../shared/currentAccount";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { Permission } from "shared/permissions";

export default async function getCurrentUser(_ = null, { session }: Ctx): Promise<CurrentAccount | null> {
  const auth = await loadAuthorization(session);
  const { user } = auth;
  if (!user) {
    return null;
  }
  // Authorization already loaded the active, unmerged account. Never spread its grants.
  return {
    id: user.id, // Blitz's account boundary still needs the session owner's numeric ID.
    publicId: parsePublicId<"User">(user.publicId),
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    cssClass: user.cssClass,
    isSysAdmin: auth.hasPermission(Permission.sysadmin),
  };
}
