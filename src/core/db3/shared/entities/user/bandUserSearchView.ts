import { Prisma } from "@prisma/client";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xBandUser } from "./bandUser";
import { bandUserProfileSelection } from "./bandUserProfile";

const selection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        ...bandUserProfileSelection.select,
        bandRole: {
            select: {
                publicId: true,
                name: true,
                description: true,
                color: true,
                sortOrder: true
            }
        },
    },
});
const contract = deriveViewContract(xBandUser, selection);

export const bandUserSearchView = defineView({
    viewID: "BandUser_Search",
    entity: xBandUser,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});

export type BandUserSearchDto = DtoOf<typeof bandUserSearchView>;

export type BandUserSearchClient = ClientOf<typeof bandUserSearchView>;
