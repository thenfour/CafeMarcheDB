import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import db from "db";
import { cmauthorize } from "src/auth/server/cmResolver";
import { AuditDetailInputSchema } from "../shared/audit/auditContracts";
import { readAuditDetail } from "../server/audit/auditRead";

export default resolver.pipe(
    resolver.zod(AuditDetailInputSchema),
    cmauthorize({ permission: Permission.sysadmin, requireUser: true }),
    (input, ctx) => readAuditDetail(db, ctx.auth, input),
);
