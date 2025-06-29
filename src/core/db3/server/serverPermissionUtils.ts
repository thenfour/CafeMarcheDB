import { TransactionalPrismaClient } from "../shared/apiTypes";
import { GetDefaultVisibilityPermission } from "../shared/db3Helpers";

export const getDefaultVisibilityPermission = async (dbt: TransactionalPrismaClient) => {
    return await GetDefaultVisibilityPermission(dbt);
}