import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { AuditDetailSchema, type AuditDetailInput } from "../../shared/audit/auditContracts";
import { parseAuditSnapshot } from "../../shared/audit/auditSnapshot";
import { executeDB3Read, type DB3ReadDatabase } from "../db3ReadExecution";
import { readAuditRecord, readAuditFileTags } from "./auditReferences";

function requireAuditAuthority(auth: CMServerAuthorization): void {
    auth.requireUser();
    if (!auth.globalPermissions.includesName(Permission.sysadmin)) {
        throw new AuthorizationError("Platform audit authority is required.");
    }
}

export function readAuditFilters(database: DB3ReadDatabase, auth: CMServerAuthorization) {
    return executeDB3Read(database, auth, async context => {
        requireAuditAuthority(context.authorization);
        const tables = await context.database.change.findMany({ distinct: ["table"], select: { table: true }, orderBy: { table: "asc" } });
        const actorIds = await context.database.change.findMany({ distinct: ["userId"], where: { userId: { not: null } }, select: { userId: true } });
        const users = await context.database.user.findMany({
            where: { id: { in: actorIds.flatMap(row => row.userId === null ? [] : [row.userId]) } },
            select: { publicId: true, name: true, email: true },
        });
        return { tableNames: tables.map(row => ({ tableName: row.table })), users };
    });
}

export function readAuditDetail(database: DB3ReadDatabase, auth: CMServerAuthorization, input: AuditDetailInput) {
    return executeDB3Read(database, auth, async context => {
        requireAuditAuthority(context.authorization);
        const row = await context.database.change.findUnique({
            where: { id: input.changeId }, select: {
                table: true, recordId: true, oldValues: true, newValues: true, user: { select: { publicId: true, name: true } },
            },
        });
        if (!row) {
            throw new Error("Audit record is unavailable.");
        }
        const record = await readAuditRecord(context.database, row.table, row.recordId, input);
        const related = row.table.toLowerCase() === "file" ? await readAuditFileTags(context.database, row.recordId, input) : [];
        return AuditDetailSchema.parse({
            user: row.user, record, related, oldValues: parseAuditSnapshot(row.oldValues), newValues: parseAuditSnapshot(row.newValues),
        });
    });
}
