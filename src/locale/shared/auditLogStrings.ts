import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Audit log browser", schema: z.string() });
export const auditLogStrings = {
    "auditLog.title": label("Audit log"),
    "auditLog.tables": label("Tables"),
    "auditLog.users": label("Users"),
    "auditLog.filterTables": label("Filter tables"),
    "auditLog.filterUsers": label("Filter users"),
    "auditLog.copy": label("Copy JSON"),
    "auditLog.dump": label("Dump to console"),
    "auditLog.expand": label("Expand JSON"),
    "auditLog.close": label("Close"),
    "auditLog.markdown": label("Preview Markdown"),
    "auditLog.copied": label("JSON copied to clipboard"),
    "auditLog.dumped": label("JSON written to console"),
    "auditLog.copyFailed": label("Unable to copy JSON"),
    "auditLog.unavailable": label("Reference unavailable"),
    "auditLog.deleted": label("Deleted reference"),
    "auditLog.unknownActor": label("Unknown user"),
    "auditLog.loading": label("Loading audit details..."),
    "auditLog.order": label("Order"),
    "auditLog.song": label("Song"),
    "auditLog.comment": label("Comment"),
} as const;
