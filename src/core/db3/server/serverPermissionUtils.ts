import { PermissionSignificance } from "../db3";
import { TransactionalPrismaClient } from "../shared/apiTypes";

export const getDefaultVisibilityPermission = async (dbt: TransactionalPrismaClient) => {
    return await dbt.permission.findFirst({
        where: {
            significance: PermissionSignificance.Visibility_Members,
        }
    });
}