import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xUserTag } from "../../schema/user";

const UserTagArgs = Prisma.validator<Prisma.UserTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
        cssClass: true,
    },
});

const userTagViewContract = deriveViewContract(
    xUserTag,
    UserTagArgs,
);

export const userTagEditorView = defineCrudView({
    viewID: "UserTag_Editor",
    entity: xUserTag,
    operations: { create: true, update: true, delete: true },
    hydrate: userTagViewContract.hydrate,
    selection: userTagViewContract.prismaSelection,
    dtoSchema: userTagViewContract.dtoSchema,
});

export const userTagEventSearchSelection = Prisma.validator<Prisma.UserTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        userAssignments: {
            where: {
                user: { isDeleted: false },
            },
            select: {
                userId: true,
            },
        },
    },
});

const userTagEventSearchContract = deriveViewContract(
    xUserTag,
    userTagEventSearchSelection,
);

export const userTagEventSearchView = defineView({
    viewID: "UserTag_EventSearch",
    entity: xUserTag,
    selection: userTagEventSearchContract.prismaSelection,
    dtoSchema: userTagEventSearchContract.dtoSchema,
    hydrate: userTagEventSearchContract.hydrate,
});
