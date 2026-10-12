import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import db from "db";
import { cmauthorize } from "src/auth/server/cmResolver";
import { AuditFilterInputSchema } from "../shared/audit/auditContracts";
import { readAuditFilters } from "../server/audit/auditRead";

export default resolver.pipe(
    resolver.zod(AuditFilterInputSchema),
    cmauthorize({ permission: Permission.sysadmin, requireUser: true }),
    (_input, ctx) => readAuditFilters(db, ctx.auth),
);
