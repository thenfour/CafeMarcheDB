import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf } from "../../core/db3View";
import { permissionEntity } from "../user/userEntities";
import { menuLinkEntity } from "./menuLinkEntities";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";

const MenuLinkEditorDtoSchema = z.object({
    id: z.number().int(),
    applicationPage: z.string().nullable().optional(),
    groupName: z.string().optional(),
    caption: z.string().optional(),
    iconName: z.string().nullable().optional(),
    linkType: z.string().optional(),
    externalURI: z.string().nullable().optional(),
    wikiSlug: z.string().nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    groupCssClass: z.string().optional(),
    itemCssClass: z.string().optional(),
});

export const menuLinkEditorView = defineCrudView({
    viewID: "MenuLink_Editor",
    entity: menuLinkEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: MenuLinkEditorDtoSchema,
    hydrate: dto => menuLinkEntity.schema.getClientModel(dto, "view"),
});

const MenuLinkListDtoSchema = z.object({
    ...MenuLinkEditorDtoSchema.shape,
    sortOrder: z.number().int(),
    realm: z.string().nullable(),
    createdAt: z.date(),
    createdByUserId: z.number().int().nullable(),
    createdByUser: z.object({
        id: z.number().int(),
        name: z.string(),
        cssClass: z.string().nullable(),
    }).nullable(),
});

const menuLinkAutoSelection = ZodToPrismaSelection(MenuLinkListDtoSchema);
const menuLinkListSelection = Prisma.validator<Prisma.MenuLinkDefaultArgs>()(menuLinkAutoSelection);

type MenuLinkListDto = z.infer<typeof MenuLinkListDtoSchema>;

export function hydrateMenuLinkListDto(
    dto: MenuLinkListDto,
    references: DB3ReferenceProvider,
) {
    return {
        ...dto,
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
    };
}

export const menuLinkListView = defineView({
    viewID: "MenuLink_List",
    entity: menuLinkEntity,
    selection: menuLinkListSelection,
    dtoSchema: MenuLinkListDtoSchema,
    hydrate: hydrateMenuLinkListDto,
});

export type MenuLinkListClient = ClientOf<typeof menuLinkListView>;
