import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { isPublicId, parsePublicId, type BandUserPublicId, type BandUserInstrumentPublicId } from "shared/publicId";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel, DB3FieldReadAuth, SqlSpecialColumnFunction } from "../../db3core";
import { BoolField, foreignRef, MakePKfield, MakePublicIdField, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { GenericIntegerField } from "../../columnTypes/genericInteger";
import { serverOwnedField } from "../../columnTypes/inherited";
import { xUserMinimum } from "../../schema/user";
import { xBandInstrument, InstrumentIdentity } from "../instrument/bandInstrumentContracts";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const instrumentAssignments = defineAuthMap({
    ...kReadOnlyAuthMap,
    PreMutate: Permission.manage_users,
    PreMutateAsOwner: Permission.login,
});

const memberSelection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        publicId: true,
        userId: true,
        user: {
            select: {
                publicId: true,
                name: true
            }
        },
        bandUserInstruments: {
            select: {
                publicId: true,
                isPrimary: true,
                bandInstrumentId: true,
                bandInstrument: {
                    select: { publicId: true }
                }
            },
            orderBy: {
                publicId: "asc"
            },
        },
    },
});

// ---------------------------------------------------------------------------
// Membership creation, roles and deactivation have dedicated administration flows.
// This descriptor exposes only instrument assignment writes to existing active members.
export const xBandUser = defineTable({
    tableName: "bandUser", tableUniqueName: "BandUser",
    prismaModel: prismaModel<Prisma.BandUserDelegate>(),
    getIdentity: (row: { publicId: BandUserPublicId }) => row.publicId,
    bandScope: { member: "bandId", managePermission: Permission.manage_users },
    readConsistency: "snapshot", deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.view_users_basic_info,
        ViewOwn: Permission.login,
        Edit: Permission.manage_users,
        EditOwn: Permission.login,
        Insert: Permission.never_grant,
    },
    queryParameters: {},
    getParameterizedWhereClause: (): Prisma.BandUserWhereInput[] => [
        { isDeleted: false, user: { isDeleted: false, mergedIntoUserId: null } },
    ],
    naturalOrderBy: { publicId: "asc" },
    getSelectionArgs: () => memberSelection,
    getRowInfo: row => ({
        pk: row.publicId,
        name: row.user?.name ?? "",
        ownerUserId: row.userId
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandUserPublicId>(),
        isDeleted: columnName => new BoolField({
            columnName, allowNull: false, defaultValue: false,
            specialFunction: SqlSpecialColumnFunction.isDeleted, authMap: kReadOnlyAuthMap
        }),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap: defineAuthMap({
                ...kReadOnlyAuthMap,
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant
            })
        })),
        user: foreignRef(() => xUserMinimum, {
            fkidMember: "userId",
            specialFunction: SqlSpecialColumnFunction.ownerUser,
            authMap: kReadOnlyAuthMap,
        }),
        bandUserInstruments: tagsRef("BandUserInstrument", "BandInstrument", {
            associationLocalObjectMember: "bandUser", associationForeignObjectMember: "bandInstrument",
            readVisibility: "association",
            authMap: instrumentAssignments,
            getQuickFilterWhereClause: () => false, getCustomFilterWhereClause: () => false,
        }),
    }),
});

// ---------------------------------------------------------------------------
// Associations inherit scope and person ownership through their membership.
// Only the aggregate command changes them, so a generic row edit cannot create two primaries.
export const xBandUserInstrument = defineTable({
    tableName: "bandUserInstrument", tableUniqueName: "BandUserInstrument",
    prismaModel: prismaModel<Prisma.BandUserInstrumentDelegate>(),
    getIdentity: (row: { publicId: BandUserInstrumentPublicId }) => row.publicId,
    bandScope: {
        member: "bandId",
        via: {
            relation: "bandUser",
            ownerUserMember: "userId",
        },
        managePermission: Permission.manage_users
    },
    deletePolicy: "disabled",
    readConsistency: "snapshot",
    tableAuthMap: {
        View: Permission.view_users_basic_info,
        ViewOwn: Permission.login,
        Edit: Permission.never_grant,
        EditOwn: Permission.never_grant,
        Insert: Permission.never_grant,
    },
    queryParameters: {},
    getParameterizedWhereClause: (_params, auth): Prisma.BandUserInstrumentWhereInput[] => [
        {
            bandUser: {
                // todo: this should be centralized
                isDeleted: false,
                user: {
                    isDeleted: false,
                    mergedIntoUserId: null
                }
            },
            bandInstrument: {
                bandId: auth.requireBand().id,
            }
        },
    ],
    naturalOrderBy: { publicId: "asc" },
    getSelectionArgs: () => ({
        select: {
            publicId: true,
            isPrimary: true,
            bandInstrumentId: true,
            bandInstrument: {
                select: { publicId: true }
            }
        }
    }),
    getRowInfo: row => ({
        pk: row.publicId,
        name: "",
        ownerUserId: row.bandUser?.userId ?? null
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandUserInstrumentPublicId>(),
        isPrimary: columnName => new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap }),
        bandInstrument: foreignRef(() => xBandInstrument, { fkidMember: "bandInstrumentId", authMap: kReadOnlyAuthMap }),
        bandUser: foreignRef(() => xBandUser, { fkidMember: "bandUserId", authMap: kReadOnlyAuthMap }),
    }),
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandUser: typeof xBandUser;
        BandUserInstrument: typeof xBandUserInstrument;
    }
}

// ---------------------------------------------------------------------------
// views

const memberContract = deriveViewContract(xBandUser, memberSelection);
export const bandUserInstrumentsView = defineView({
    viewID: "BandUser_Instruments",
    entity: xBandUser,
    selection: memberContract.prismaSelection,
    dtoSchema: memberContract.dtoSchema,
    hydrate: memberContract.hydrate,
});

export type BandUserInstrumentsDto = DtoOf<typeof bandUserInstrumentsView>;

// ---------------------------------------------------------------------------
// commands

const MembershipIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"BandUser">(value));

const commandSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("replace"), membershipId: MembershipIdentity,
        instrumentIds: z.array(InstrumentIdentity).max(64).refine(ids => new Set(ids).size === ids.length, "Duplicate instruments"),
    }).strict(),
    z.object({ kind: z.literal("setPrimary"), membershipId: MembershipIdentity, instrumentId: InstrumentIdentity }).strict(),
]);

export type BandUserInstrumentsEdit = z.infer<typeof commandSchema>;

export const bandUserInstrumentsCommand = defineCommand({
    commandID: "BandUser_EditInstruments", entity: xBandUser, dtoSchema: commandSchema,
    resultSchema: z.object({ membershipId: MembershipIdentity }).strict(),
    serialize: (edit: BandUserInstrumentsEdit) => commandSchema.parse(edit),
    invalidation: { mode: "caller", entityIDs: ["BandUser", "BandUserInstrument"] },
});
