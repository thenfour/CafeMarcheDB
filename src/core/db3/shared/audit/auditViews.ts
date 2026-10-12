import { Prisma } from "db";
import { defineView } from "../core/db3View";
import { deriveViewContract } from "../core/db3ViewContract";
import { xChange } from "../schema/admin";

const contract = deriveViewContract(xChange, Prisma.validator<Prisma.ChangeDefaultArgs>()({
    select: {
        id: true, action: true, table: true, recordId: true, context: true, operationId: true,
        changedAt: true, oldValues: true, newValues: true,
        userId: true,
    },
}));
export const auditLogView = defineView({
    viewID: "Change_AuditLog", entity: xChange,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
