import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Account dependency analysis label", schema: z.string() });
export const accountAnalysisStrings = {
    "accountAnalysis.scope": label("Shared-account totals include all bands, inactive memberships and hidden or deleted records. Dependencies are summarized as counts."),
    "accountAnalysis.inspect": label("Inspect account dependencies"),
    "accountAnalysis.compare": label("Compare with user..."),
    "accountAnalysis.comparing": label("Comparison mode active"),
    "accountAnalysis.clear": label("Clear comparison"),
    "accountAnalysis.refresh": label("Refresh analysis"),
    "accountAnalysis.loading": label("Loading account analysis..."),
    "accountAnalysis.failed": label("Could not load account analysis."),
    "accountAnalysis.memberships": label("Band memberships"),
    "accountAnalysis.noMemberships": label("This account has no band memberships."),
    "accountAnalysis.active": label("Active"),
    "accountAnalysis.inactive": label("Inactive"),
    "accountAnalysis.retiredBand": label("Deleted band"),
    "accountAnalysis.retiredRole": label("Deleted role"),
    "accountAnalysis.signInMethods": label("Sign-in Methods"),
    "accountAnalysis.accountSettings": label("Account Settings"),
    "accountAnalysis.membershipSettings": label("Membership Settings"),
    "accountAnalysis.globalRole": label("Global Account Role"),
    "accountAnalysis.protectedAdministrator": label("Protected Administrator"),
    "accountAnalysis.deletedGlobalRole": label("Global Role Is Deleted"),
    "accountAnalysis.mergedInto": label("Merged Into Account"),
    "accountAnalysis.mergedAt": label("Merged At"),
    "accountAnalysis.risk.sysadmin": label("User is a system administrator"),
    "accountAnalysis.risk.merged": label("This account has already been merged"),
    "accountAnalysis.risk.sessions": label("User has active sessions"),
    "accountAnalysis.risk.unnamedRole": label("(unnamed)"),
    "accountAnalysis.risk.globalRole": plainStaticString({
        defaultValue: "User has elevated global role: {name}",
        description: "Account dependency role warning", schema: z.string(), parameters: [{ key: "name", description: "Resolved global role name", type: "string" }]
    }),
    "accountAnalysis.risk.content": plainStaticString({
        defaultValue: "User has created {count, number} content items",
        description: "Account creator dependency warning", schema: z.string(), parameters: [{ key: "count", description: "Creator dependencies", type: "number" }]
    }),
    "accountAnalysis.risk.participation": plainStaticString({
        defaultValue: "User has {count, number} participation records",
        description: "Account participation dependency warning", schema: z.string(), parameters: [{ key: "count", description: "Participation dependencies", type: "number" }]
    }),
    "accountAnalysis.risk.activity": plainStaticString({
        defaultValue: "User was active {count, number} days ago",
        description: "Account activity warning", schema: z.string(), parameters: [{ key: "count", description: "Elapsed days since activity", type: "number" }]
    }),
} as const;

export type AccountAnalysisStringKey = keyof typeof accountAnalysisStrings;