import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xEventSongList } from "../../schema/event";

const contract = deriveViewContract(xEventSongList, Prisma.validator<Prisma.EventSongListDefaultArgs>()({
    select: { publicId: true, name: true, eventId: true },
}));
export const eventSongListReferenceView = defineView({
    viewID: "EventSongList_Reference", entity: xEventSongList,
    selection: contract.prismaSelection, dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});
