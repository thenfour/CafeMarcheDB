import { Prisma } from "@prisma/client";
import { z } from "zod";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { deriveFieldWriteSchema } from "../../core/db3FieldValidation";
import { xUserMinimum } from "../../schema/user";
import { xBandUser } from "./bandUser";
import { bandUserInstrumentsSelection } from "./bandUserInstruments";
import { bandUserTagsSelection } from "./bandUserTags";
import { bandUserRolesSelection } from "./bandUserRoles";

const identityContract = deriveViewContract(xBandUser, Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        publicId: true,
        user: {
            select:
            {
                publicId: true,
                name: true
            }
        }
    },
}));
export const bandUserIdentityView = defineView({
    viewID: "BandUser_Identity",
    entity: xBandUser,
    selection: identityContract.prismaSelection,
    dtoSchema: identityContract.dtoSchema,
    hydrate: identityContract.hydrate,
    // Identity pickers represent active members even during an authorized recovery read.
    where: { isDeleted: false },
});

// One authorized membership supplies the profile and directory; catalogs supply localized labels.
export const bandUserProfileSelection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        ...bandUserInstrumentsSelection.select,
        ...bandUserTagsSelection.select,
        ...bandUserRolesSelection.select,
        createdAt: true,
        isDeleted: true,
        user:
        {
            select:
            {
                publicId: true,
                name: true,
                email: true,
                phone: true
            }
        },
    },
});

const contract = deriveViewContract(xBandUser, bandUserProfileSelection);

export const bandUserProfileView = defineView({
    viewID: "BandUser_Profile",
    entity: xBandUser,
    selection: contract.prismaSelection,
    where: { isDeleted: false },
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});
export type BandUserProfileDto = DtoOf<typeof bandUserProfileView>;

// Only shared display name and phone are editable here. Account lifecycle and email use dedicated flows.
const editSchema = z.object({
    membershipId: xBandUser.identitySchema,
    name: z.string().trim().pipe(deriveFieldWriteSchema(xUserMinimum.fields.name, "update")),
    phone: z.string().trim().nullable().pipe(deriveFieldWriteSchema(xUserMinimum.fields.phone, "update")).optional(),
}).strict();

export type BandUserProfileEdit = z.infer<typeof editSchema>;
export const bandUserProfileCommand = defineCommand({
    commandID: "BandUser_EditProfile", entity: xBandUser,
    dtoSchema: editSchema,
    resultSchema: z.object({
        membershipId: xBandUser.identitySchema,
        personId: xUserMinimum.identitySchema
    }).strict(),
    serialize: (edit: BandUserProfileEdit) => editSchema.parse(edit),
    invalidation: { mode: "caller", entityIDs: ["BandUser", "User"] },
});
