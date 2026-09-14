import db from "db";
import { resolveUserSettings } from "shared/userSettings";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

export const loadUserSettings = async (
    userId: number | null, // anonymous users still get default settings (they are considered users on the site)
    database: TransactionalPrismaClient = db,
) => {
    if (userId == null) {
        return resolveUserSettings([]);
    }
    return resolveUserSettings(await database.userSetting.findMany({
        where: { userId },
        select: { name: true, value: true },
    }));
};
