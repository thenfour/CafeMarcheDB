// todo: this would not be needed if sysadmin were a normal permission;
// this effort is planned.
import { AuthorizationError } from "blitz";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

export class ActualSysadminAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "This operation requires an actual Sysadmin account.";
        this.name = "ActualSysadminAuthorizationError";
    }
}

export const requireActualSysadmin = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<void> => {
    const actor = userId
        ? await db.user.findFirst({
            select: { isSysAdmin: true },
            where: { id: userId },
        })
        : null;
    if (actor?.isSysAdmin !== true) {
        throw new ActualSysadminAuthorizationError();
    }
};
