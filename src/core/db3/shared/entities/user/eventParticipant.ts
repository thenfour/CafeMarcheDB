import { Prisma } from "@prisma/client";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xBandUser } from "./bandUser";
import { bandUserInstrumentsSelection } from "./bandUserInstruments";
import { bandUserTagsSelection } from "./bandUserTags";

// Attendance needs a person's display data and the selected membership's assignments.
const selection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        ...bandUserInstrumentsSelection.select,
        ...bandUserTagsSelection.select,
        user: {
            select: {
                publicId: true,
                name: true,
                cssClass: true
            }
        },
    },
});
const contract = deriveViewContract(xBandUser, selection);

export const eventParticipantView = defineView({
    viewID: "BandUser_EventParticipant",
    entity: xBandUser,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});
export type EventParticipantDto = DtoOf<typeof eventParticipantView>;

export function eventParticipantFromMembership(member: EventParticipantDto | null) {
    if (!member || member.user.name === undefined) {
        return null;
    }
    return {
        // Person identity is used for profile links and the dedicated attendance API.
        // Response and invitation joins use this selected-band membership identity.
        publicId: member.user.publicId,
        membershipId: member.publicId,
        name: member.user.name,
        cssClass: member.user.cssClass,
        bandUserInstruments: member.bandUserInstruments,
        bandUserTagAssignments: member.bandUserTagAssignments,
    };
}
export type EventParticipant = NonNullable<ReturnType<typeof eventParticipantFromMembership>>;
