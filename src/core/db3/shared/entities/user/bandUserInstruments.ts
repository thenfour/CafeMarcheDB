import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { isPublicId, parsePublicId, type BandUserInstrumentPublicId } from "shared/publicId";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { BoolField, foreignRef, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { xBandInstrument, BandInstrumentIdentity } from "../instrument/bandInstrumentContracts";
import { xBandUser, activeBandMembershipWhere } from "./bandUser";
import { kReadOnlyAuthMap } from "../common/entityCommon";

export const bandUserInstrumentsSelection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
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
            bandUser: activeBandMembershipWhere(),
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
        BandUserInstrument: typeof xBandUserInstrument;
    }
}

// ---------------------------------------------------------------------------
// views

const memberContract = deriveViewContract(xBandUser, bandUserInstrumentsSelection);
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
        instrumentIds: z.array(BandInstrumentIdentity).max(64).refine(ids => new Set(ids).size === ids.length, "Duplicate instruments"),
    }).strict(),
    z.object({ kind: z.literal("setPrimary"), membershipId: MembershipIdentity, instrumentId: BandInstrumentIdentity }).strict(),
]);

export type BandUserInstrumentsEdit = z.infer<typeof commandSchema>;

export const bandUserInstrumentsCommand = defineCommand({
    commandID: "BandUser_EditInstruments", entity: xBandUser, dtoSchema: commandSchema,
    resultSchema: z.object({ membershipId: MembershipIdentity }).strict(),
    serialize: (edit: BandUserInstrumentsEdit) => commandSchema.parse(edit),
    invalidation: { mode: "caller", entityIDs: ["BandUser", "BandUserInstrument"] },
});
