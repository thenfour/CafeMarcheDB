import { useQuery } from "@blitzjs/rpc";
import type { BandUserPublicId, UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "../../db3/components/useDB3Context";
import db3queries from "../../db3/queries/db3queries";
import { eventParticipantFromMembership, eventParticipantView } from "../../db3/shared/entities/user/eventParticipant";

type EventParticipantFilter =
    | {
        readonly personPublicIds: readonly UserPublicId[];
        readonly membershipIds?: never
    }
    | {
        readonly membershipIds: readonly BandUserPublicId[];
        readonly personPublicIds?: never
    };

export function useEventParticipants(filter: EventParticipantFilter) {
    const context = useDB3QueryContext();
    const [result] = useQuery(db3queries, {
        ...context,
        table: {
            tableID: eventParticipantView.tableID,
            tableName: eventParticipantView.tableName,
            viewID: eventParticipantView.viewID
        },
        filter: {
            tableParams: {
                ...filter,
            }
        },
        cmdbQueryContext: "event participants",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    return result.items.flatMap(item => {
        const participant = eventParticipantFromMembership(eventParticipantView.parseDto(item));
        return participant ? [participant] : [];
    });
}
