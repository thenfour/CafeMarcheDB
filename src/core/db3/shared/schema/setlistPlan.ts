
import { gGeneralPaletteList } from "@/shared/color";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GhostField, MakeColorField, MakeCreatedAtField, MakeIsDeletedField, MakePKfield, MakeSortOrderField } from "../db3basicFields";
import * as db3 from "../db3core";
import { MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";

const xAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.setlist_planner_access,
    PostQuery: Permission.setlist_planner_access,
    PreMutateAsOwner: Permission.setlist_planner_access,
    PreMutate: Permission.setlist_planner_access,
    PreInsert: Permission.setlist_planner_access,
} as const;

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
export const xSetlistPlanGroup = new db3.xTable({
    getInclude: (clientIntention): Prisma.SetlistPlanGroupInclude => {
        return SetlistPlanGroupArgs.include;
    },
    tableName: "SetlistPlanGroup",
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
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xAuthMap, }),
        MakeDescriptionField({ authMap: xAuthMap, }),
        MakeColorField({ authMap: xAuthMap, }),
        MakeSortOrderField({ authMap: xAuthMap, }),
        MakeCreatedAtField({}),
        MakeCreatedByField(),
    ]
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
export const xSetlistPlan = new db3.xTable({
    getInclude: (clientIntention): Prisma.SetlistPlanInclude => {
        return {};
    },
    tableName: "SetlistPlan",
    naturalOrderBy: SetlistPlanNaturalOrderBy,
    getRowInfo: (row: SetlistPlanPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xAuthMap, }),
        MakeDescriptionField({ authMap: xAuthMap, }),
        MakeSortOrderField({ authMap: xAuthMap, }),
        MakeIsDeletedField({ authMap: xAuthMap, }),
        MakeCreatedAtField({}),
        MakeCreatedByField(),
        MakeVisiblePermissionField({ authMap: xAuthMap }),

        new GhostField({ memberName: "groupId", authMap: xAuthMap }),
        new GhostField({ memberName: "payloadJson", authMap: xAuthMap }),
    ]
});


