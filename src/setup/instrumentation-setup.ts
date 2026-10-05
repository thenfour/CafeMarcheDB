import db from "db";
import { ValidateRouteRegistry } from "../auth/shared/backstageRoutes";
import { initializeAccessControl } from "./accessControl";

export async function instrumentationSetup(): Promise<void> {
    await ValidateRouteRegistry();
    await initializeAccessControl(db);
}
