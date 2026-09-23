import { DateTimeRange } from "shared/time";

export interface EventDateRangeDtoFields {
    startsAt?: Date | null;
    durationMillis?: bigint;
    isAllDay?: boolean;
}

type CompleteEventDateRangeDtoFields = Required<EventDateRangeDtoFields>;

export type WithEventDateRange<T extends EventDateRangeDtoFields> =
    Omit<T, keyof EventDateRangeDtoFields>
    & (T extends CompleteEventDateRangeDtoFields
        ? { dateRange: DateTimeRange }
        : { dateRange?: DateTimeRange });

/**
 * Converts the persisted Event timing tuple into its client-side value object.
 * A null start is a valid TBD range; an omitted field means authorization did
 * not return a complete tuple, so no DateTimeRange can be exposed.
 */
export function hydrateEventDateRange<T extends EventDateRangeDtoFields>(
    dto: T,
): WithEventDateRange<T> {
    const { startsAt, durationMillis, isAllDay, ...rest } = dto;
    if (startsAt === undefined || durationMillis === undefined || isAllDay === undefined) {
        return rest as WithEventDateRange<T>;
    }

    return {
        ...rest,
        dateRange: new DateTimeRange({
            startsAtDateTime: startsAt,
            durationMillis: Number(durationMillis),
            isAllDay,
        }),
    } as WithEventDateRange<T>;
}
