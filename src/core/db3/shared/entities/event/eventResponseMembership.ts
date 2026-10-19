import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { BandUserPublicId } from "shared/publicId";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel, SqlSpecialColumnFunction } from "../../db3core";
import { foreignRef, GenericIntegerField, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { serverOwnedField } from "../../columnTypes/inherited";
import { kReadOnlyAuthMap } from "../common/entityCommon";
import { xUserMinimum } from "../../schema/user";

// Recorded answers retain former memberships. This reference exposes identity only;
// active participant profiles and assignments still use the ordinary BandUser reader.
export const xEventResponseMembership = defineTable({
    tableName: "bandUser",
    tableUniqueName: "EventResponseMembership",
    prismaModel: prismaModel<Prisma.BandUserDelegate>(),
    getIdentity: (row: { publicId: BandUserPublicId }) => row.publicId,
    bandScope: { member: "bandId", managePermission: BandPermission.manage_users },
    readConsistency: "snapshot", deletePolicy: "disabled",
    tableAuthMap: {
        View: BandPermission.view_events_nonpublic,
        ViewOwn: BandPermission.view_events_nonpublic,
        Edit: Permission.never_grant,
        EditOwn: Permission.never_grant,
        Insert: Permission.never_grant,
    },
    getSelectionArgs: () => ({ select: { publicId: true } }),
    getRowInfo: row => ({
        pk: row.publicId,
        name: "",
        ownerUserId: row.userId
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandUserPublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: defineAuthMap({ ...kReadOnlyAuthMap, PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant }),
        })),
        user: foreignRef(() => xUserMinimum, {
            fkidMember: "userId", specialFunction: SqlSpecialColumnFunction.ownerUser,
            authMap: defineAuthMap({ ...kReadOnlyAuthMap, PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant }),
        }),
    }),
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        EventResponseMembership: typeof xEventResponseMembership;
    }
}
