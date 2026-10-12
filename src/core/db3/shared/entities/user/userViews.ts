import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xUser } from "../../schema/user";
import { xPlatformUser } from "./platformUser";

const userIdentitySummaryArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        publicId: true,
        signInMethods: {
            select: { type: true, displayId: true },
            orderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
        },
    },
});

// Sign-in inspection belongs to platform maintenance and must work without a selected band.
const userIdentitySummaryContract = deriveViewContract(xPlatformUser, userIdentitySummaryArgs);
export const userIdentitySummaryView = defineView({
    viewID: "User_IdentitySummary",
    entity: xPlatformUser,
    selection: userIdentitySummaryContract.prismaSelection,
    dtoSchema: userIdentitySummaryContract.dtoSchema,
    hydrate: userIdentitySummaryContract.hydrate,
});

// This editor maintains shared person data. Band membership editors own assignments.
const userEditorSelection = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        publicId: true,
        isDeleted: true,
        name: true,
        email: true,
        phone: true,
        cssClass: true,
        createdAt: true,
        isSysAdmin: true,
    },
});
const userEditorContract = deriveViewContract(xUser, userEditorSelection);

export const userEditorView = defineCrudView({
    viewID: "User_Editor",
    entity: xUser,
    operations: { create: true, update: true },
    selection: userEditorContract.prismaSelection,
    dtoSchema: userEditorContract.dtoSchema,
    hydrate: userEditorContract.hydrate,
});
