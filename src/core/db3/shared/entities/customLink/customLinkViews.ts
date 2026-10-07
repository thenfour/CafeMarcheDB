import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf } from "../../core/db3View";
import { xCustomLink } from "../../schema/customLinks";
import { xCustomLinkFile } from "./customLinkFile";
import { deriveViewContract } from "../../core/db3ViewContract";

//-----------------------------------------------------------------------

const customLinkFileArgs = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        publicId: true,
        fileLeafName: true,
        description: true,
        isDeleted: true,
        externalURI: true,
    }
});

const customLinkFileViewContract = deriveViewContract(xCustomLinkFile, customLinkFileArgs);

export const customLinkFileSelectionView = defineView({
    viewID: "CustomLink_FileSelection",
    entity: xCustomLinkFile,
    where: { externalURI: null },
    dtoSchema: customLinkFileViewContract.dtoSchema,
    selection: customLinkFileViewContract.prismaSelection,
    hydrate: customLinkFileViewContract.hydrate,
});

//-----------------------------------------------------------------------
const customLinkEditorArgs = Prisma.validator<Prisma.CustomLinkDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        slug: true,
        destinationURL: true,
        fileId: true,
        file: {
            select: customLinkFileArgs.select,
        },
        redirectType: true,
        intermediateMessage: true,
        forwardQuery: true,
    }
});

const customLinkEditorViewContract = deriveViewContract(xCustomLink, customLinkEditorArgs);

export const customLinkEditorView = defineCrudView({
    viewID: "CustomLink_Editor",
    entity: xCustomLink,
    operations: { create: true, update: true, delete: true },
    dtoSchema: customLinkEditorViewContract.dtoSchema,
    selection: customLinkEditorViewContract.prismaSelection,
    hydrate: customLinkEditorViewContract.hydrate,
});


//-----------------------------------------------------------------------
const customLinkListArgs = Prisma.validator<Prisma.CustomLinkDefaultArgs>()({
    select: {
        ...customLinkEditorArgs.select,
        createdAt: true,
        createdByUserId: true,
        createdByUser: {
            select: {
                publicId: true,
                name: true,
                cssClass: true,
            }
        },
        _count: {
            select: {
                visits: true,
            }
        }
    }
});

const customLinkListViewContract = deriveViewContract(xCustomLink, customLinkListArgs);

export const customLinkListView = defineView({
    viewID: "CustomLink_List",
    entity: xCustomLink,
    selection: customLinkListViewContract.prismaSelection,
    dtoSchema: customLinkListViewContract.dtoSchema,
    hydrate: customLinkListViewContract.hydrate,
});

export type CustomLinkListClient = ClientOf<typeof customLinkListView>;
