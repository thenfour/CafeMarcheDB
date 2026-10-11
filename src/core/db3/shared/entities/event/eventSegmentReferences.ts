import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xEventSegment } from "../../schema/event";

const contract = deriveViewContract(xEventSegment, Prisma.validator<Prisma.EventSegmentDefaultArgs>()({
    select: { publicId: true, name: true, eventId: true, startsAt: true },
}));
export const eventSegmentReferenceView = defineView({
    viewID: "EventSegment_Reference", entity: xEventSegment,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
