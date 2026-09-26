import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf } from "../../core/db3View";
import { xCustomLink } from "../../schema/customLinks";
import { xUser } from "../../schema/user";

const CustomLinkEditorDtoSchema = z.object({
    id: z.number().int(),

    name: z.string().optional(),
    description: z.string().optional(),

    slug: z.string().optional(),
    destinationURL: z.string().optional(),
    redirectType: z.string().nullable().optional(),
    intermediateMessage: z.string().nullable().optional(),
    forwardQuery: z.boolean().optional(),
});

export const customLinkEditorView = defineCrudView({
    viewID: "CustomLink_Editor",
    entity: xCustomLink,
    operations: { create: true, update: true, delete: true },
    dtoSchema: CustomLinkEditorDtoSchema,
    hydrate: dto => xCustomLink.getClientModel(dto, "view"),
});

const CustomLinkListDtoSchema = z.object({
    ...CustomLinkEditorDtoSchema.shape,
    createdAt: z.date(),
    createdByUserId: xUser.identitySchema.nullable(),
    createdByUser: z.object({
        publicId: xUser.identitySchema,
        name: z.string(),
        cssClass: z.string().nullable(),
    }).nullable(),
    _count: z.object({
        visits: z.number().int(),
    }),
});

const customLinkAutoSelection = ZodToPrismaSelection(CustomLinkListDtoSchema);
const customLinkListSelection = Prisma.validator<Prisma.CustomLinkDefaultArgs>()(customLinkAutoSelection);

export const customLinkListView = defineView({
    viewID: "CustomLink_List",
    entity: xCustomLink,
    selection: customLinkListSelection,
    dtoSchema: CustomLinkListDtoSchema,
    hydrate: dto => dto,
});

export type CustomLinkListClient = ClientOf<typeof customLinkListView>;
