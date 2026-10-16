import { Routes } from "@blitzjs/next";
import { CmdbRouteRegistry } from "./cmdbRoutes";

export function ValidateRouteRegistry(): void {
    // Blitz route factories return their page pattern even without parameter values.
    const blitzRoutePaths: string[] = [
        // arg i wish there was a central known place to get ALL POSSIBLE routes that will be checked.
        "/_error", // Next supplies this page without adding a Blitz route factory.
        ...Object.values(Routes).map(route => route({} as never).pathname)
    ];
    const ourRoutePaths: string[] = CmdbRouteRegistry.allPatterns;
    const errorMessages: string[] = [];
    for (const path of blitzRoutePaths) {
        if (!ourRoutePaths.includes(path)) {
            errorMessages.push(`Missing route in our registry: ${path}`);
        }
    }
    // and check stale routes in our registry that are not in Blitz routes
    for (const path of ourRoutePaths) {
        if (!blitzRoutePaths.includes(path)) {
            errorMessages.push(`Stale route in our registry: ${path}`);
        }
    }
    if (errorMessages.length > 0) {
        throw new Error(`Route registry validation failed:\n${errorMessages.join("\n")}`);
    }
}
