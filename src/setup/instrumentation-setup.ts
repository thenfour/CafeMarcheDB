import db from "db";
import { initializeAccessControl } from "./accessControl";
import { ValidateRouteRegistry } from "../route/routeValidation";

export async function instrumentationSetup(): Promise<void> {
    await ValidateRouteRegistry();
    await initializeAccessControl(db);
}
