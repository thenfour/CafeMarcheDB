import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xSetlistPlan } from "../../schema/setlistPlan";

const contract = deriveViewContract(xSetlistPlan, Prisma.validator<Prisma.SetlistPlanDefaultArgs>()({
    select: { publicId: true, name: true },
}));
export const setlistPlanReferenceView = defineView({
    viewID: "SetlistPlan_Reference", entity: xSetlistPlan,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
