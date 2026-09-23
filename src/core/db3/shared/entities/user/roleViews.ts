import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { xRole } from "../../schema/user";

const RolePermissionEditorDtoSchema = z.object({
    id: z.number().int(),
    roleId: z.number().int().optional(),
    permissionId: z.number().int().optional(),
    permission: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
    }).nullable().optional(),
});

const RoleEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().nullable().optional(),
    significance: z.string().nullable().optional(),
    permissions: z.array(RolePermissionEditorDtoSchema).optional(),
});

const roleEditorBaseSelection = ZodToPrismaSelection(RoleEditorDtoSchema);
const roleEditorSelection = Prisma.validator<Prisma.RoleDefaultArgs>()({
    select: {
        ...roleEditorBaseSelection.select,
        permissions: {
            ...roleEditorBaseSelection.select.permissions,
            orderBy: [
                { permission: { sortOrder: "asc" } },
                { permission: { name: "asc" } },
                { permission: { id: "asc" } },
            ],
        },
    },
});

export const roleEditorView = defineCrudView({
    viewID: "Role_Editor",
    entity: xRole,
    operations: { create: true, update: true },
    selection: roleEditorSelection,
    dtoSchema: RoleEditorDtoSchema,
    hydrate: dto => xRole.getClientModel(dto, "view"),
});
