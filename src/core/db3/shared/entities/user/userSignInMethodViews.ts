import { Prisma } from "db";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xUserSignInMethod } from "../../schema/userSignInMethod";

const contract = deriveViewContract(xUserSignInMethod, Prisma.validator<Prisma.UserSignInMethodDefaultArgs>()({
    select: {
        publicId: true,
        type: true,
        identifier: true,
        createdAt: true,
    },
}));

export const userSignInMethodAdminView = defineView({
    viewID: "UserSignInMethod_Admin",
    entity: xUserSignInMethod,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});
