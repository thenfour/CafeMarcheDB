import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isPermission, type Permission } from "shared/permissions";
import { SplitQuickFilter } from "shared/quickFilter";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import type { PaginatedQueryRequestInput } from "../../db3core";
import { xBandUser } from "./bandUser";
import { bandUserRolesSelection } from "./bandUserRoles";

const PAGE_SIZE = 20;

const contract = deriveViewContract(xBandUser, Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: { ...bandUserRolesSelection.select, isDeleted: true },
}));

export const bandUserLifecycleView = defineView({
    viewID: "BandUser_Lifecycle", entity: xBandUser,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
export type BandUserLifecycleDto = DtoOf<typeof bandUserLifecycleView>;

const editSchema = z.object({
    membershipId: xBandUser.identitySchema,
    action: z.enum(["deactivate", "reactivate"]),
    acknowledgeContinuityRisk: z.boolean(),
}).strict();
const resultIdentity = { membershipId: xBandUser.identitySchema, isDeleted: z.boolean() };

export type BandUserLifecycleEdit = z.infer<typeof editSchema>;
export const bandUserLifecycleCommand = defineCommand({
    commandID: "BandUser_SetActive",
    entity: xBandUser,
    dtoSchema: editSchema,
    resultSchema: z.discriminatedUnion("status", [
        z.object({ ...resultIdentity, status: z.literal("saved") }).strict(),
        z.object({
            ...resultIdentity, status: z.literal("confirmationRequired"),
            permissions: z.array(z.custom<Permission>(isPermission)).min(1),
        }).strict(),
    ]),
    serialize: (edit: BandUserLifecycleEdit) => editSchema.parse(edit),
    invalidation: { mode: "caller", entityIDs: ["BandUser"] },
});

/** Recovery uses the ordinary authorized DB3 query, including its totals and paging. */
export function bandMemberRecoveryQuery(search: string, page: number, context: PresentationInput): PaginatedQueryRequestInput {
    return {
        ...context,
        table: {
            tableID: bandUserLifecycleView.tableID,
            tableName: bandUserLifecycleView.tableName,
            viewID: bandUserLifecycleView.viewID,
        },
        includeDeleted: true,
        filter: {
            quickFilterValues: SplitQuickFilter(search),
            tableParams: { membershipStatus: "inactive" },
        },
        orderBy: { user: "asc" },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
        cmdbQueryContext: "member recovery",
    };
}
