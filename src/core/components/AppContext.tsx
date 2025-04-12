
import React, { createContext, useContext, useMemo } from "react";
import { slugifyWithDots } from "shared/rootroot";
import { ActivityFeatureAssociations } from "../db3/shared/activityTracking";

// Our context will hold an array of strings that represent the "stack."
type AppContextDataBase = ActivityFeatureAssociations & {
    stack: string;

    // eventId?: number | undefined,
    // songId?: number | undefined,
    // wikiPageId?: number | undefined,
    // fileId?: number | undefined,
    // queryText?: string | undefined,
    // attendanceId?: number | undefined,
    // eventSegmentId?: number | undefined,
    // customLinkId?: number | undefined;
    // eventSongListId?: number | undefined;
    // frontpageGalleryItemId?: number | undefined;
    // menuLinkId?: number | undefined;
    // setlistPlanId?: number | undefined;
    // songCreditTypeId?: number | undefined;
    // instrumentId?: number | undefined;

};
const AppContextData = createContext<AppContextDataBase>({
    stack: "",
});

// A simple hook to retrieve the stack
export function useAppContext() {
    return useContext(AppContextData)
}


type Props = ActivityFeatureAssociations & {
    name?: string | undefined,

    // eventId?: number | undefined,
    // songId?: number | undefined,
    // wikiPageId?: number | undefined,
    // fileId?: number | undefined,
    // queryText?: string | undefined,
    // attendanceId?: number | undefined,
    // eventSegmentId?: number | undefined,

    children: React.ReactNode
}

export function AppContextMarker({ name, children, ...associations }: Props) {
    const parentStack = useAppContext();

    const nextStack = useMemo<AppContextDataBase>(() => {
        const newStack = name ? `${parentStack.stack}/${slugifyWithDots(name)}` : parentStack.stack;//:  [...parentStack.stack, slugifyWithDots(props.name)] : parentStack.stack;
        const ret: AppContextDataBase = {
            ...parentStack,
            ...associations,
            stack: newStack,
            //stack: newStack,
            // eventId: props.eventId || parentStack.eventId,
            // songId: props.songId || parentStack.songId,
            // wikiPageId: props.wikiPageId || parentStack.wikiPageId,
            // fileId: props.fileId || parentStack.fileId,
            // queryText: props.queryText || parentStack.queryText,
            // attendanceId: props.attendanceId || parentStack.attendanceId,
            // eventSegmentId: props.eventSegmentId || parentStack.eventSegmentId,
        };
        return ret;
    }, [parentStack, name, ...Object.values(associations)]);

    // Provide this new stack to child components
    return (
        <AppContextData.Provider value={nextStack}>
            {children}
        </AppContextData.Provider>
    )
}

