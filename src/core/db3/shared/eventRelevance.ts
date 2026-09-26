
// these are semantic classes, but also sort order.

// these are stored in the database, so don't change their values without considering
// the migration!
export const gEventRelevanceClass = {
    Pinned: 1000, // priority above others; explicitly pinned.
    Ongoing: 1100,
    Upcoming: 1200,
    RecentPast: 1300,
    TBD: 1400,
    Future: 1500,
    Hidden: 1600,
} as const;

type ClassifiableRelevance = Exclude<keyof typeof gEventRelevanceClass, "Pinned" | "Hidden">;

export type EventRelevanceClassName =
    keyof typeof gEventRelevanceClass;

export type EventRelevanceClassValue =
    typeof gEventRelevanceClass[EventRelevanceClassName];

type EventRelevanceContext = {
    now: Date,
    sevenDaysFromNow: Date,
    twentyFourHoursAgo: Date,
}

type EventBase = {
    startsAt: Date | null, // TBD events have this null. TBD events are only "relevant" when explicitly pinned.
    durationMillis: number | null,
    isAllDay: boolean | null,
    endDateTime: Date | null,
}

type EventWithRelevanceOverride = EventBase & {
    relevanceClassOverride: EventRelevanceClassValue | null,
};

type EventWithRelevanceAndPrio<TEvent extends EventBase> = Omit<TEvent, "relevanceClassOverride"> & {
    relevance_class: EventRelevanceClassValue,
    isExplicitlyPinned: boolean,
    prioWithinClass: number,
};

// outputs a priority
type ClassifyWithPrio = (e: EventBase, ctx: EventRelevanceContext) => number | null;

// list of predicates to say "is the given event within this class?"
const gClassifiers: Record<ClassifiableRelevance, ClassifyWithPrio> = {
    RecentPast: (e, ctx) => {
        if (!e.endDateTime) {
            return null; // TBD
        }
        const howLongAgo = ctx.now.getTime() - e.endDateTime.getTime();
        const prio = -howLongAgo;
        return e.endDateTime >= ctx.twentyFourHoursAgo && e.endDateTime <= ctx.now ? prio : null;
    },
    Ongoing: (e, ctx) => {
        if (!e.startsAt || !e.endDateTime) {
            return null; // TBD
        }
        // prio always 1; don't bother classifying prio for ongoing
        return e.startsAt <= ctx.now && (e.endDateTime >= ctx.now) ? 1 : null;
    },
    Upcoming: (e, ctx) => {
        // for events that start in the next seven days
        // prio closer to now.
        if (!e.startsAt) {
            return null; // TBD
        }
        const timeUntilStart = e.startsAt.getTime() - ctx.now.getTime(); // bigger value = further in the future
        const prio = -timeUntilStart; // bigger value = further in future = less prio
        return e.startsAt > ctx.now && e.startsAt <= ctx.sevenDaysFromNow ? prio : null;
    },
    TBD: (e, ctx) => {
        if (e.startsAt) {
            return null;
        }
        return 0; // no way to differentiate.
    },
    Future: (e, ctx) => {
        if (!e.startsAt) {
            return null; // TBD
        }
        // similar prio style to upcoming.
        const timeUntilStart = e.startsAt.getTime() - ctx.now.getTime(); // bigger value = further in the future
        const prio = -timeUntilStart; // bigger value = further in future = less prio
        return e.startsAt > ctx.sevenDaysFromNow ? prio : null;
    },
};

// takes an event from db (with override), outputs the final classification and priority
const ClassifyEventRelevance = <TEvent extends EventWithRelevanceOverride>(e: TEvent, ctx: EventRelevanceContext): EventWithRelevanceAndPrio<TEvent> => {
    const { relevanceClassOverride, ...rest } = e;
    const isExplicitlyPinned = relevanceClassOverride === gEventRelevanceClass.Pinned;
    const ret: EventWithRelevanceAndPrio<TEvent> = {
        ...rest,
        // A pin is itself a visible classification when the event is too old to
        // fit any of the date-based classes.
        relevance_class: isExplicitlyPinned ? gEventRelevanceClass.Pinned : gEventRelevanceClass.Hidden,
        isExplicitlyPinned,
        prioWithinClass: isExplicitlyPinned ? 0 : -Infinity,
    };

    // for explicitly pinned, reclassify which can't include hidden.
    // for explicitly hidden, set the class to Hidden; prio unused
    // for explicitly other relevance classes, leave and update prio.
    // for not overridden, classify but can include the Hidden class (will be removed later)

    // for explicitly pinned, reclassify
    if (relevanceClassOverride === gEventRelevanceClass.Pinned) {
        for (const [className, classifier] of Object.entries(gClassifiers)) {
            const prio = classifier(e, ctx);
            if (prio !== null) {
                ret.relevance_class = gEventRelevanceClass[className as ClassifiableRelevance];
                ret.prioWithinClass = prio;
                break; // stop at the first matching class
            }
        }
    } else if (relevanceClassOverride === gEventRelevanceClass.Hidden) {
        // for explicitly hidden, set the class to Hidden
        // make this a special case so we don't need to create a "classifier" for hidden items
        // which have no concept of prio and there's not enough info to "classify an event into the hidden" category.
        ret.relevance_class = gEventRelevanceClass.Hidden;
    } else if (relevanceClassOverride != null) {
        // for explicitly other relevance classes, leave and update prio.
        const className = Object.keys(gEventRelevanceClass)
            .find(key => gEventRelevanceClass[key] === relevanceClassOverride) as ClassifiableRelevance;
        if (!className) {
            throw new Error("Failed to determine class name for event relevance override");
        }

        const classifier = gClassifiers[className];
        if (!classifier) {
            throw new Error(`No classifier found for class name: ${className}`);
        }
        const prio = classifier(e, ctx);
        ret.relevance_class = relevanceClassOverride;
        ret.prioWithinClass = prio ?? 0;
    } else {
        // for not overridden, classify but can include the Hidden class (will be removed later)
        for (const [className, classifier] of Object.entries(gClassifiers)) {
            // Undated events are only front-page relevant through an explicit
            // pin or the legacy explicit TBD override.
            if (className === "TBD") continue;
            const prio = classifier(e, ctx);
            if (prio !== null) {
                ret.relevance_class = gEventRelevanceClass[className as ClassifiableRelevance];
                ret.prioWithinClass = prio;
                break; // stop at the first matching class
            }
        }
        // if was hidden, remains hidden.
    }

    return ret;
};

export const kMaxRelevantEventsToQuery = 20 as const;
export const kMaxRelevantEventsToShow = 5 as const;

// when we fallback to showing future events, limit the number. they're considered
// far-off enough that we don't want to clutter the front page with them.

// setting this to 1 is like saying "if there are no relevant events,
// we show you 'the next event to think about'". better than nothing, and better than spamming too many.
export const kMaxRelevantFutureEventsToShow = 1 as const;

// Classification preserves the caller's identity and other payload fields.
export const GetRelevantEvents = <TEvent extends EventWithRelevanceOverride>(events: TEvent[], ctx: EventRelevanceContext) => {
    // - calc final relevance classification (after applying overrides)

    const classifiedEvents = events.map(e => ClassifyEventRelevance(e, ctx));
    // - hide events
    const visibleEvents = classifiedEvents.filter(e => e.relevance_class !== gEventRelevanceClass.Hidden);

    // - sort events by relevance and priority, and pick ones to display
    // here we need some relevanceclass-specific logic;
    // only show "Future" events if there are no class 1, 2, or 3 events,
    // or if they are pinned explicitly.

    const hasNonFuture = visibleEvents.some(e => e.relevance_class !== gEventRelevanceClass.Future);

    let eventsToShow: EventWithRelevanceAndPrio<TEvent>[];
    if (hasNonFuture) {
        // remove future unless pinned
        eventsToShow = visibleEvents.filter(e => e.relevance_class !== gEventRelevanceClass.Future || e.isExplicitlyPinned);
    } else {
        eventsToShow = visibleEvents;
    }

    // sort by:
    // - isExplicitlyPinned first (true = highest prio)
    // - prio class
    // - prioWithinClass (higher value = higher prio)
    const orderedEventsToShow = eventsToShow.sort((a, b) => {
        if (a.isExplicitlyPinned !== b.isExplicitlyPinned) {
            return a.isExplicitlyPinned ? -1 : 1;
        }
        if (a.relevance_class !== b.relevance_class) {
            return a.relevance_class - b.relevance_class; // lower class value = higher relevance
        }
        return b.prioWithinClass - a.prioWithinClass;
    });

    if (!hasNonFuture) {
        const pinnedEvents = orderedEventsToShow.filter(e => e.isExplicitlyPinned);
        const fallbackFutureEvents = orderedEventsToShow
            .filter(e => !e.isExplicitlyPinned)
            .slice(0, kMaxRelevantFutureEventsToShow);
        return [...pinnedEvents, ...fallbackFutureEvents].slice(0, kMaxRelevantEventsToShow);
    }

    return orderedEventsToShow.slice(0, kMaxRelevantEventsToShow);
};
