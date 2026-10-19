import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Role administration interface label", schema: z.string() });
export const roleAdministrationStrings = {
    "roles.title": label("Role definitions"),
    "roles.global": label("Global account roles"),
    "roles.band": label("Band membership roles"),
    "roles.permissions": label("Permissions"),
    "roles.designations": label("Built-in role assignments"),
    "roles.sysadmin": label("Sysadmin role"),
    "roles.public": label("Public band role"),
    "roles.newUsers": label("Role for new band members"),
    "roles.globalPublic": label("Public global role"),
    "roles.globalNewUsers": label("Role for new accounts"),
    "roles.invalidDesignation": label("Select one role to repair the missing or duplicate assignment."),
    "roles.failed": label("Role change failed. Your selection is retained."),
    "roles.retry": label("Retry role change"),
    "roles.refreshFailed": label("The role was saved, but refreshing failed. Refresh the page before editing again."),
    "roles.matrix": label("Role permission matrix"),
    "roles.loading": label("Loading roles…"),
    "roles.unknown": label("Show unknown permissions"),
    "roles.knownPermission": label("This permission is in sync with code."),
    "roles.unknownPermission": label("This permission is not known in code."),
    "roles.account": label("Global account role"),
    "roles.editAccount": label("Change global account role"),
    "roles.noAccountRole": label("Use Public global role"),
    "roles.accountDescription": label("This changes the shared account's global permissions. Band memberships keep their own roles."),
    "roles.accountUnavailable": label("You cannot change this account's global role."),
    "roles.continuity": label("This would remove the last ordinary holder of these capabilities:"),
    "roles.acknowledge": label("I understand and want to continue."),
    "roles.save": label("Save role"),
    "roles.saving": label("Saving role…"),
} as const;
