import db from "db";
import { ValidateRouteRegistry } from "../route/backstageRoutes";
import { initializeAccessControl } from "./accessControl";

export async function instrumentationSetup(): Promise<void> {
    await ValidateRouteRegistry();
    await initializeAccessControl(db);
}
