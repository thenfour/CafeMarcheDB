import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { xMenuLink } from "../../schema/menuLink";

const menuLinkEditorSelection = Prisma.validator<Prisma.MenuLinkDefaultArgs>()({
    select: {
        id: true,
        applicationPage: true,
        groupName: true,
        caption: true,
        iconName: true,
        linkType: true,
        externalURI: true,
        wikiSlug: true,
        visiblePermissionId: true,
        groupCssClass: true,
        itemCssClass: true,
    },
});

const menuLinkEditorContract = deriveViewContract(
    xMenuLink,
    menuLinkEditorSelection,
    { references: dashboardReferenceContract },
);

export const menuLinkEditorView = defineCrudView({
    viewID: "MenuLink_Editor",
    entity: xMenuLink,
    operations: { create: true, update: true, delete: true },
    selection: menuLinkEditorContract.prismaSelection,
    dtoSchema: menuLinkEditorContract.dtoSchema,
    references: menuLinkEditorContract.referenceContract,
    hydrate: menuLinkEditorContract.hydrate,
});

const menuLinkListSelection = Prisma.validator<Prisma.MenuLinkDefaultArgs>()({
    select: {
        ...menuLinkEditorSelection.select,
        sortOrder: true,
        realm: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
            select: {
                publicId: true,
                name: true,
                cssClass: true,
            },
        },
    },
});

const menuLinkListContract = deriveViewContract(
    xMenuLink,
    menuLinkListSelection,
    { references: dashboardReferenceContract },
);

export const menuLinkListView = defineView({
    viewID: "MenuLink_List",
    entity: xMenuLink,
    selection: menuLinkListContract.prismaSelection,
    dtoSchema: menuLinkListContract.dtoSchema,
    references: menuLinkListContract.referenceContract,
    hydrate: menuLinkListContract.hydrate,
});

export type MenuLinkListClient = ClientOf<typeof menuLinkListView>;
