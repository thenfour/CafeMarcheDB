import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xBandUserTag } from "./bandUserTagViews";
import "./bandUserTags"; // Register the child descriptor before compiling its invitation view.

export const userTagEventSearchSelection = Prisma.validator<Prisma.BandUserTagDefaultArgs>()({
    select: {
        publicId: true,
        bandUserTagAssignments: { select: { bandUserId: true } },
    },
});
const contract = deriveViewContract(xBandUserTag, userTagEventSearchSelection);
export const userTagEventSearchView = defineView({
    viewID: "BandUserTag_EventInvitation", entity: xBandUserTag,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
