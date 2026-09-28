import { TransactionalPrismaClient } from "../shared/apiTypes";
import { GetDefaultVisibilityPermission } from "./db3Helpers";

export const getDefaultVisibilityPermission = async (dbt: TransactionalPrismaClient) => {
    return await GetDefaultVisibilityPermission(dbt);
}