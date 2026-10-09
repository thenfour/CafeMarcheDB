import { Prisma } from "db";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xUser } from "../../schema/user";

/** Shared person identity is eligible only through an active selected-band membership. */
export function activeBandPersonWhere(bandId: number): Prisma.UserWhereInput {
    return {
        // these are covered naturally by user. don't need to repeat here.
        // - don't clog query with redundant conditions.
        // - don't pretend that this query owns user visibility/authorization policies.
        //isDeleted: false,
        //mergedIntoUserId: null,
        bandUsersByUser: {
            some: {
                bandId,

                // in theory this should also not be needed here because it should also be
                // handled automatically by db3. but this type of filtering is not handled by db3 (yet).
                // without this, inactive band members would still appear in song credits user picker for example.
                isDeleted: false,
            }
        },
    };
}

const contract = deriveViewContract(xUser, Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        publicId: true,
        name: true
    },
}));

export const bandPersonReferenceView = defineView({
    viewID: "User_BandPersonReference",
    entity: xUser,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
    where: ({ auth }) => activeBandPersonWhere(auth.requireBand().id),
});
