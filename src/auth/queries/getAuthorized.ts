import { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { CMAuthorize } from "types";

export default async function getAuthorization({ reason, permission }: { reason: string, permission: Permission }, { session }: Ctx) {
    return CMAuthorize({
        reason,
        permission,
        publicData: session?.$publicData,
    });
}
