import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";
const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Shared-account merge control", schema: z.string() });
export const accountMergeStaticStrings = {
    "accountMerge.open": label("Merge with another user"),
    "accountMerge.title": label("Merge users"),
    "accountMerge.select": label("Select another user"),
    "accountMerge.pickTitle": label("Select the other account"),
    "accountMerge.preview": label("Preview merge"),
    "accountMerge.accept": label("Accept report and merge accounts"),
    "accountMerge.swap": label("Swap Main and Retiring"),
    "accountMerge.cancel": label("Cancel"),
    "accountMerge.refresh": label("Refresh analysis"),
    "accountMerge.keep": label("Account to keep"),
    "accountMerge.retire": label("Account to retire"),
    "accountMerge.loading": label("Preparing report..."),
    "accountMerge.merging": label("Merging accounts..."),
    "accountMerge.loadFailed": label("Unable to load account analysis. Refresh and try again."),
    "accountMerge.instruction": label("Select a second account and choose which account remains Main. Preview the fixed policies; accepting the report applies all of them."),
    "accountMerge.membershipTitle": label("Band memberships and preferences"),
    "accountMerge.membershipPolicy": label("In shared bands keep Main's membership, role, active/inactive state and preferences, including blanks and defaults. Transfer Retiring-only memberships with their state and preferences; clear their band roles to avoid importing privileges."),
    "accountMerge.membershipConsequence": label("Inactive memberships and retired bands remain inactive. Imported memberships may need a separate band-role assignment."),
    "accountMerge.sharedMembers": label("Shared memberships retained on Main"),
    "accountMerge.importedMembers": label("Retiring-only band memberships transferred"),
    "accountMerge.importedRoles": label("Imported band roles cleared"),
    "accountMerge.discardedPreferences": label("Overlapping membership preferences discarded"),
} as const;
