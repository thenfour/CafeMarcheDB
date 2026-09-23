
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GhostField, MakeColorField, MakeCreatedAtField, MakeIsDeletedField, MakePKfield, MakeSortOrderField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

const xAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.setlist_planner_access,
    PostQuery: Permission.setlist_planner_access,
    PreMutateAsOwner: Permission.setlist_planner_access,
    PreMutate: Permission.setlist_planner_access,
    PreInsert: Permission.setlist_planner_access,
});

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.setlist_planner_access,
    View: Permission.setlist_planner_access,
    EditOwn: Permission.setlist_planner_access,
    Edit: Permission.setlist_planner_access,
    Insert: Permission.setlist_planner_access,
} as const;


const SetlistPlanGroupArgs = Prisma.validator<Prisma.SetlistPlanGroupDefaultArgs>()({
    include: {
    }
});

export type SetlistPlanGroupPayload = Prisma.SetlistPlanGroupGetPayload<typeof SetlistPlanGroupArgs>;

export const SetlistPlanGroupNaturalOrderBy: Prisma.SetlistPlanGroupOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { name: 'asc' },
    { createdAt: 'desc' },
    { id: 'asc' },
];

// model SetlistPlanGroup {
//   id          Int     @id @default(autoincrement())
//   name        String  @db.VarChar(768)
//   description String  @db.MediumText
//   color       String? @db.VarChar(768)
//   sortOrder   Int     @default(0)
//   createdByUserId Int
//   createdByUser   User     @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
//   createdAt       DateTime @default(now())

//   setlistPlans SetlistPlan[]

//   @@index([name])
// }

////////////////////////////////////////////////////////////////
export const xSetlistPlanGroup = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SetlistPlanGroupDelegate>(),
    getIdentity: (group: { id: number }) => group.id,
    getSelectionArgs: (): Prisma.SetlistPlanGroupDefaultArgs => {
        return SetlistPlanGroupArgs;
    },
    tableName: "SetlistPlanGroup",
    deletePolicy: "hard",
    sortOrderPolicy: { groupingColumn: null, scope: "explicitRowIds" },
    naturalOrderBy: SetlistPlanGroupNaturalOrderBy,
    getRowInfo: (row: SetlistPlanGroupPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        iconName: null,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: xAuthMap, }),
        description: () => MakeDescriptionField({ authMap: xAuthMap, }),
        color: () => MakeColorField({ authMap: xAuthMap, }),
        sortOrder: () => MakeSortOrderField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField({}),
        createdByUser: () => MakeCreatedByField(),
    })
});



const SetlistPlanArgs = Prisma.validator<Prisma.SetlistPlanDefaultArgs>()({
    include: {
    }
});

export type SetlistPlanPayload = Prisma.SetlistPlanGetPayload<typeof SetlistPlanArgs>;

export const SetlistPlanNaturalOrderBy: Prisma.SetlistPlanOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
    { name: 'asc' },
    { createdAt: 'desc' },
    { id: 'asc' },
];

////////////////////////////////////////////////////////////////
export const xSetlistPlan = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SetlistPlanDelegate>(),
    getSelectionArgs: (): Prisma.SetlistPlanDefaultArgs => {
        return {};
    },
    tableName: "SetlistPlan",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.setlist_planner_access,
    restorePermission: Permission.setlist_planner_access,
    sortOrderPolicy: { groupingColumn: "groupId", scope: "explicitRowIds" },
    naturalOrderBy: SetlistPlanNaturalOrderBy,
    getRowInfo: (row: SetlistPlanPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: xAuthMap, }),
        description: () => MakeDescriptionField({ authMap: xAuthMap, }),
        sortOrder: () => MakeSortOrderField({ authMap: xAuthMap, }),
        isDeleted: () => MakeIsDeletedField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField({}),
        createdByUser: () => MakeCreatedByField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xAuthMap }),

        groupId: memberName => new GhostField({ memberName, authMap: xAuthMap }),
        payloadJson: memberName => new GhostField({ memberName, authMap: xAuthMap }),
    })
});


